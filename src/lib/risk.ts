import { execSync } from "child_process";
import { all, run } from "./db";
import { uid } from "./ids";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type StudentRisk = {
  studentId: string;
  name: string;
  rollNo: string;
  className: string;
  branch: string;
  attendancePct: number;
  marksPct: number;
  weakSubjects: number;
  decline: boolean;
  cluster: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  suggestion: {
    category: "ACADEMIC" | "CAREER" | "DISCIPLINE";
    note: string;
    followUp: string;
  } | null;
};

export type Confusion = { tp: number; fp: number; tn: number; fn: number };

export type RiskModel = {
  samples: number;
  positives: number;
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion: Confusion;
  weights: {
    bias: number;
    attendanceGap: number;
    marksGap: number;
    weakSubjects: number;
    decline: number;
  };
};

export type ClusterSummary = {
  name: string;
  count: number;
  avgAttendance: number;
  avgMarks: number;
};

type Feat = {
  studentId: string;
  name: string;
  rollNo: string;
  className: string;
  branch: string;
  att: number;
  marks: number;
  weak: number;
  decline: number;
  label: number;
};

function loadDeclineMap() {
  const rows = all<{ student_id: string; type: string; date: string; pct: number }>(
    `SELECT m.student_id, UPPER(IFNULL(a.type,'')) as type, IFNULL(a.date,'') as date,
            AVG(m.obtained * 100.0 / NULLIF(a.max_marks, 0)) as pct
     FROM marks m
     JOIN assessments a ON a.id = m.assessment_id
     GROUP BY m.student_id, a.id`
  );
  const byStu = new Map<string, { type: string; date: string; pct: number }[]>();
  rows.forEach((r) => {
    const list = byStu.get(r.student_id) || [];
    list.push({ type: r.type, date: r.date, pct: Number(r.pct) || 0 });
    byStu.set(r.student_id, list);
  });
  const map = new Map<string, number>();
  byStu.forEach((list, id) => {
    const ut1 = list.filter((x) => x.type === "UT1");
    const ut2 = list.filter((x) => x.type === "UT2");
    const mean = (xs: { pct: number }[]) => xs.reduce((s, x) => s + x.pct, 0) / xs.length;
    let decline = 0;
    if (ut1.length && ut2.length) {
      decline = mean(ut2) + 3 < mean(ut1) ? 1 : 0;
    } else if (list.length >= 2) {
      const ordered = list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const first = ordered[0].pct;
      const last = ordered[ordered.length - 1].pct;
      decline = last + 3 < first ? 1 : 0;
    }
    map.set(id, decline);
  });
  return map;
}

function loadFeatures(opts?: { classIds?: string[]; collegeId?: string }): Feat[] {
  const classIds = opts?.classIds;
  const collegeId = opts?.collegeId;
  const extra: unknown[] = [];
  let where = "";
  if (collegeId) {
    where += " AND d.college_id = ?";
    extra.push(collegeId);
  }
  if (classIds?.length) {
    where += ` AND st.class_id IN (${classIds.map(() => "?").join(",")})`;
    extra.push(...classIds);
  }
  const att = all<{
    student_id: string;
    name: string;
    roll_no: string;
    class_name: string;
    branch: string;
    present: number;
    total: number;
  }>(
    `SELECT st.id as student_id, u.name, st.roll_no, c.name as class_name, d.code as branch,
            SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) as present,
            COUNT(r.id) as total
     FROM students st
     JOIN users u ON u.id = st.user_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     LEFT JOIN attendance_records r ON r.student_id = st.id
     WHERE 1=1 ${where}
     GROUP BY st.id`,
    extra
  );

  const marks = all<{ student_id: string; avg: number }>(
    `SELECT st.id as student_id, AVG(m.obtained * 100.0 / a.max_marks) as avg
     FROM students st
     LEFT JOIN marks m ON m.student_id = st.id
     LEFT JOIN assessments a ON a.id = m.assessment_id
     GROUP BY st.id`
  );
  const mmap = Object.fromEntries(marks.map((m) => [m.student_id, Number(m.avg) || 0]));

  const weak = all<{ student_id: string; c: number }>(
    `SELECT student_id, COUNT(*) as c FROM (
        SELECT r.student_id, s.subject_id
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.session_id
        GROUP BY r.student_id, s.subject_id
        HAVING COUNT(r.id) > 0 AND (SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) * 100.0 / COUNT(r.id)) <= 75
     ) GROUP BY student_id`
  );
  const wmap = Object.fromEntries(weak.map((w) => [w.student_id, Number(w.c)]));
  const dmap = loadDeclineMap();

  return att.map((s) => {
    const attPct = s.total ? (Number(s.present) / Number(s.total)) * 100 : 100;
    const markPct = mmap[s.student_id] || 0;
    const weakN = wmap[s.student_id] || 0;
    const decline = dmap.get(s.student_id) || 0;
    const label = attPct <= 75 || markPct < 55 || weakN > 0 || decline === 1 ? 1 : 0;
    return {
      studentId: s.student_id,
      name: s.name,
      rollNo: s.roll_no,
      className: s.class_name,
      branch: s.branch,
      att: attPct,
      marks: markPct,
      weak: weakN,
      decline,
      label
    };
  });
}

function callMlService(
  payload: object
): { model: RiskModel; students: StudentRisk[]; clusters: ClusterSummary[] } {
  try {
    const body = JSON.stringify(payload);
    // Use execSync to call curl synchronously so the outer function stays sync
    const raw = execSync(
      `curl -sf -X POST -H "Content-Type: application/json" -d @- ${ML_SERVICE_URL}/predict`,
      { input: body, encoding: "utf8", timeout: 30000 }
    );
    return JSON.parse(raw) as { model: RiskModel; students: StudentRisk[]; clusters: ClusterSummary[] };
  } catch (e: unknown) {
    throw new Error(`ML service error: ${(e as Error).message}`);
  }
}

export function scoreStudents(
  opts?: { classIds?: string[]; studentId?: string; collegeId?: string }
): { model: RiskModel; students: StudentRisk[]; clusters: ClusterSummary[] } {
  const allRows = loadFeatures({ collegeId: opts?.collegeId, classIds: opts?.classIds });
  const payload = {
    students: allRows.map((r) => ({
      studentId: r.studentId,
      name: r.name,
      rollNo: r.rollNo,
      className: r.className,
      branch: r.branch,
      att: r.att,
      marks: r.marks,
      weak: r.weak,
      decline: r.decline,
      label: r.label,
    })),
    studentId: opts?.studentId ?? null,
    collegeId: opts?.collegeId ?? null,
  };
  const result = callMlService(payload);
  persistMl(result.model, result.students);
  return { model: result.model, students: result.students, clusters: result.clusters };
}

function persistMl(model: RiskModel, students: StudentRisk[]) {
  try {
    run(
      `INSERT INTO ml_model_runs (id, samples, train_size, test_size, accuracy, precision_pct, recall_pct, f1, tp, fp, tn, fn)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid("mlr_"),
        model.samples,
        model.trainSize,
        model.testSize,
        model.accuracy,
        model.precision,
        model.recall,
        model.f1,
        model.confusion.tp,
        model.confusion.fp,
        model.confusion.tn,
        model.confusion.fn
      ]
    );
    const upsert = `INSERT INTO ml_scores (student_id, attendance_pct, marks_pct, weak_subjects, decline, cluster, score, level, reasons, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(student_id) DO UPDATE SET
         attendance_pct=excluded.attendance_pct,
         marks_pct=excluded.marks_pct,
         weak_subjects=excluded.weak_subjects,
         decline=excluded.decline,
         cluster=excluded.cluster,
         score=excluded.score,
         level=excluded.level,
         reasons=excluded.reasons,
         updated_at=datetime('now')`;
    students.forEach((s) => {
      run(upsert, [
        s.studentId,
        s.attendancePct,
        s.marksPct,
        s.weakSubjects,
        s.decline ? 1 : 0,
        s.cluster,
        s.score,
        s.level,
        s.reasons.join(" · ")
      ]);
    });
  } catch (e) {
    console.warn("[amp] ml persist skipped:", (e as Error).message);
  }
}
