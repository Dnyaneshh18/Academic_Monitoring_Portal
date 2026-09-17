import { all, run } from "./db";
import { uid } from "./ids";

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

function sigmoid(z: number) {
  if (z < -20) return 0;
  if (z > 20) return 1;
  return 1 / (1 + Math.exp(-z));
}

function rnd(seed: { n: number }) {
  seed.n = (seed.n * 16807) % 2147483647;
  return seed.n / 2147483647;
}

function shuffle<T>(arr: T[], seedNum = 42) {
  const a = arr.slice();
  const seed = { n: seedNum };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(seed) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function xs(r: Feat) {
  return {
    att: (100 - r.att) / 100,
    marks: (100 - r.marks) / 100,
    weak: Math.min(r.weak, 4) / 4,
    decline: r.decline
  };
}

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

function predict(r: Feat, b: number, wAtt: number, wMarks: number, wWeak: number, wDec: number) {
  const x = xs(r);
  return sigmoid(b + wAtt * x.att + wMarks * x.marks + wWeak * x.weak + wDec * x.decline);
}

function train(rows: Feat[]) {
  let b = -0.5;
  let wAtt = 2.2;
  let wMarks = 1.8;
  let wWeak = 0.9;
  let wDec = 1.1;
  const lr = 0.15;
  const n = Math.max(rows.length, 1);
  for (let epoch = 0; epoch < 80; epoch++) {
    let gb = 0,
      ga = 0,
      gm = 0,
      gw = 0,
      gd = 0;
    rows.forEach((r) => {
      const x = xs(r);
      const p = sigmoid(b + wAtt * x.att + wMarks * x.marks + wWeak * x.weak + wDec * x.decline);
      const err = p - r.label;
      gb += err;
      ga += err * x.att;
      gm += err * x.marks;
      gw += err * x.weak;
      gd += err * x.decline;
    });
    b -= (lr * gb) / n;
    wAtt -= (lr * ga) / n;
    wMarks -= (lr * gm) / n;
    wWeak -= (lr * gw) / n;
    wDec -= (lr * gd) / n;
  }
  return {
    weights: {
      bias: Math.round(b * 1000) / 1000,
      attendanceGap: Math.round(wAtt * 1000) / 1000,
      marksGap: Math.round(wMarks * 1000) / 1000,
      weakSubjects: Math.round(wWeak * 1000) / 1000,
      decline: Math.round(wDec * 1000) / 1000
    },
    apply: (r: Feat) => predict(r, b, wAtt, wMarks, wWeak, wDec)
  };
}

function metrics(rows: Feat[], apply: (r: Feat) => number): Confusion & { accuracy: number; precision: number; recall: number; f1: number } {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  rows.forEach((r) => {
    const pred = apply(r) >= 0.5 ? 1 : 0;
    if (pred === 1 && r.label === 1) tp += 1;
    else if (pred === 1 && r.label === 0) fp += 1;
    else if (pred === 0 && r.label === 0) tn += 1;
    else fn += 1;
  });
  const accuracy = rows.length ? (tp + tn) / rows.length : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: Math.round(accuracy * 1000) / 10,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1: Math.round(f1 * 1000) / 10
  };
}

function split80(rows: Feat[]) {
  const shuffled = shuffle(rows, 42);
  if (shuffled.length < 5) return { train: shuffled, test: shuffled };
  const nTrain = Math.max(1, Math.floor(shuffled.length * 0.8));
  return { train: shuffled.slice(0, nTrain), test: shuffled.slice(nTrain) };
}

function kmeans(rows: Feat[], k = 3) {
  const namesEmpty: ClusterSummary[] = [
    { name: "Regular", count: 0, avgAttendance: 0, avgMarks: 0 },
    { name: "Watch", count: 0, avgAttendance: 0, avgMarks: 0 },
    { name: "Critical", count: 0, avgAttendance: 0, avgMarks: 0 }
  ];
  if (!rows.length) return { labelOf: new Map<string, string>(), summaries: namesEmpty };

  const point = (r: Feat) => [r.att / 100, r.marks / 100, Math.min(r.weak, 4) / 4, r.decline];
  const pts = rows.map(point);
  const dim = 4;
  const shuffled = shuffle(rows.map((_, i) => i), 7);
  const centroids: number[][] = [];
  for (let c = 0; c < k; c++) {
    centroids.push(point(rows[shuffled[c % rows.length]]).slice());
  }

  const assign = new Array(rows.length).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < rows.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) {
          const diff = pts[i][j] - centroids[c][j];
          d += diff * diff;
        }
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sums = Array.from({ length: k }, () => Array(dim).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < rows.length; i++) {
      counts[assign[i]] += 1;
      for (let j = 0; j < dim; j++) sums[assign[i]][j] += pts[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (!counts[c]) continue;
      for (let j = 0; j < dim; j++) centroids[c][j] = sums[c][j] / counts[c];
    }
  }

  const attMean = Array(k).fill(0);
  const markMean = Array(k).fill(0);
  const counts = Array(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    const c = assign[i];
    counts[c] += 1;
    attMean[c] += rows[i].att;
    markMean[c] += rows[i].marks;
  }
  const order = [0, 1, 2].sort((a, b) => attMean[b] / Math.max(counts[b], 1) - attMean[a] / Math.max(counts[a], 1));
  const nameByIdx = ["", "", ""];
  nameByIdx[order[0]] = "Regular";
  nameByIdx[order[1] ?? order[0]] = "Watch";
  nameByIdx[order[2] ?? order[0]] = "Critical";

  const labelOf = new Map<string, string>();
  rows.forEach((r, i) => labelOf.set(r.studentId, nameByIdx[assign[i]] || "Watch"));

  const summaries: ClusterSummary[] = ["Regular", "Watch", "Critical"].map((name) => {
    const idx = nameByIdx.indexOf(name);
    const n = idx >= 0 ? counts[idx] : 0;
    return {
      name,
      count: n,
      avgAttendance: n ? Math.round((attMean[idx] / n) * 10) / 10 : 0,
      avgMarks: n ? Math.round((markMean[idx] / n) * 10) / 10 : 0
    };
  });
  return { labelOf, summaries };
}

function suggestion(r: Feat, level: RiskLevel): StudentRisk["suggestion"] {
  if (level === "LOW") return null;
  const reasons: string[] = [];
  if (r.att <= 75) reasons.push(`attendance ${Math.round(r.att)}% (at or below 75%)`);
  if (r.marks < 55) reasons.push(`internal average ${Math.round(r.marks)}%`);
  if (r.decline) reasons.push("UT / internals falling test-to-test");
  if (r.weak > 0) reasons.push(`${r.weak} subject(s) already in defaulter range`);
  const why = reasons.join("; ") || "combined attendance and internals pattern";
  if (r.att <= 75 && r.marks < 55) {
    return {
      category: "ACADEMIC",
      note: `ML risk model flagged ${r.name}. Both attendance and internals are weak (${why}). Counsel on extra lectures and a remedial UT plan.`,
      followUp: "Review after next two weeks of attendance and UT2"
    };
  }
  if (r.att <= 75) {
    return {
      category: "ACADEMIC",
      note: `ML risk model flagged ${r.name} for likely defaulter status (${why}). Discuss reasons for absence and set a recovery plan to reach 75%.`,
      followUp: "Recheck attendance after 2 weeks"
    };
  }
  return {
    category: "ACADEMIC",
    note: `ML risk model flagged ${r.name} for weak internals (${why}). Assign remedial problems and a mentor check before the next test.`,
    followUp: "Check next unit test score"
  };
}

export function scoreStudents(opts?: { classIds?: string[]; studentId?: string; collegeId?: string }) {
  const allRows = loadFeatures({ collegeId: opts?.collegeId, classIds: opts?.classIds });
  const { train: trainRows, test: testRows } = split80(allRows.length ? allRows : loadFeatures({ collegeId: opts?.collegeId }));
  const fitted = train(trainRows.length ? trainRows : allRows);
  const test = testRows.length ? testRows : trainRows;
  const m = metrics(test, fitted.apply);
  const { labelOf, summaries } = kmeans(allRows);

  let rows = allRows;
  if (opts?.studentId) rows = rows.filter((r) => r.studentId === opts.studentId);

  const students: StudentRisk[] = rows.map((r) => {
    const score = Math.round(fitted.apply(r) * 1000) / 1000;
    const level: RiskLevel =
      r.att < 60 || (r.decline && r.att < 75) || r.marks < 50 || score >= 0.85
        ? "HIGH"
        : r.att < 75 || r.marks < 60 || r.decline || score >= 0.55
          ? "MEDIUM"
          : "LOW";
    const reasons: string[] = [];
    if (r.att < 75) reasons.push(`Attendance ${Math.round(r.att * 10) / 10}%`);
    if (r.marks < 60) reasons.push(`UT average ${Math.round(r.marks * 10) / 10}%`);
    if (r.decline) reasons.push("Scores falling test-to-test");
    if (r.weak > 0) reasons.push(`${r.weak} weak subject(s)`);
    if (!reasons.length) reasons.push("Pattern currently stable");
    return {
      studentId: r.studentId,
      name: r.name,
      rollNo: r.rollNo,
      className: r.className,
      branch: r.branch,
      attendancePct: Math.round(r.att * 10) / 10,
      marksPct: Math.round(r.marks * 10) / 10,
      weakSubjects: r.weak,
      decline: Boolean(r.decline),
      cluster: labelOf.get(r.studentId) || "Watch",
      score,
      level,
      reasons,
      suggestion: suggestion(r, level)
    };
  });

  students.sort((a, b) => b.score - a.score);

  const model: RiskModel = {
    samples: allRows.length,
    positives: allRows.filter((r) => r.label === 1).length,
    trainSize: trainRows.length,
    testSize: test.length,
    accuracy: m.accuracy,
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
    confusion: { tp: m.tp, fp: m.fp, tn: m.tn, fn: m.fn },
    weights: fitted.weights
  };

  persistMl(model, students);
  return { model, students, clusters: summaries };
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
