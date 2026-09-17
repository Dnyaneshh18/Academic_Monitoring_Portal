import { all, one, run } from "./db";
import { uid } from "./ids";
import type { SessionUser } from "./auth";
import bcrypt from "bcryptjs";
import { collegeScope, isSuperAdmin } from "./college";

export { collegeScope, isSuperAdmin };

export function listCollegeSummaries() {
  return all(
    `SELECT c.id, c.code, c.name, c.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.college_id = c.id AND u.role = 'COLLEGE_ADMIN') as admin_count,
            (SELECT COUNT(*) FROM students st JOIN classes cl ON cl.id = st.class_id JOIN departments d ON d.id = cl.department_id WHERE d.college_id = c.id) as student_count,
            (SELECT COUNT(*) FROM faculty f LEFT JOIN departments d ON d.id = f.department_id JOIN users u ON u.id = f.user_id WHERE d.college_id = c.id OR u.college_id = c.id) as faculty_count,
            (SELECT COUNT(*) FROM departments d WHERE d.college_id = c.id) as dept_count
     FROM colleges c ORDER BY c.name`
  );
}

export function dashboardStats(user: SessionUser) {
  const collegeId = collegeScope(user);
  if (isSuperAdmin(user)) {
    const colleges = listCollegeSummaries();
    return {
      super: true,
      colleges,
      students: colleges.reduce((s, c) => s + Number((c as { student_count: number }).student_count || 0), 0),
      faculty: colleges.reduce((s, c) => s + Number((c as { faculty_count: number }).faculty_count || 0), 0),
      classes: one<{ c: number }>("SELECT COUNT(*) as c FROM classes")?.c ?? 0,
      subjects: one<{ c: number }>("SELECT COUNT(*) as c FROM subjects")?.c ?? 0,
      notices: one<{ c: number }>("SELECT COUNT(*) as c FROM notices")?.c ?? 0,
      attendancePct: 0,
      defaulters: 0,
      mine: {},
      byDept: [],
      recentNotices: []
    };
  }

  const scope = collegeId ? " AND d.college_id = ? " : "";
  const sp = collegeId ? [collegeId] : [];

  const students =
    one<{ c: number }>(
      `SELECT COUNT(st.id) as c FROM students st JOIN classes c ON c.id = st.class_id JOIN departments d ON d.id = c.department_id WHERE 1=1 ${scope}`,
      sp
    )?.c ?? 0;
  const faculty =
    one<{ c: number }>(
      `SELECT COUNT(f.id) as c FROM faculty f LEFT JOIN departments d ON d.id = f.department_id JOIN users u ON u.id = f.user_id WHERE 1=1 ${
        collegeId ? " AND (d.college_id = ? OR u.college_id = ?) " : ""
      }`,
      collegeId ? [collegeId, collegeId] : []
    )?.c ?? 0;
  const classes =
    one<{ c: number }>(
      `SELECT COUNT(c.id) as c FROM classes c JOIN departments d ON d.id = c.department_id WHERE 1=1 ${scope}`,
      sp
    )?.c ?? 0;
  const subjects =
    one<{ c: number }>(
      `SELECT COUNT(s.id) as c FROM subjects s JOIN departments d ON d.id = s.department_id WHERE 1=1 ${scope}`,
      sp
    )?.c ?? 0;
  const notices = one<{ c: number }>("SELECT COUNT(*) as c FROM notices")?.c ?? 0;

  const present =
    one<{ c: number }>(
      `SELECT COUNT(r.id) as c FROM attendance_records r
       JOIN students st ON st.id = r.student_id JOIN classes c ON c.id = st.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE r.status = 'PRESENT' ${scope}`,
      sp
    )?.c ?? 0;
  const total =
    one<{ c: number }>(
      `SELECT COUNT(r.id) as c FROM attendance_records r
       JOIN students st ON st.id = r.student_id JOIN classes c ON c.id = st.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE 1=1 ${scope}`,
      sp
    )?.c ?? 0;
  const attendancePct = total ? Math.round((present / total) * 1000) / 10 : 0;

  const defaulters = defaulterList(collegeId ? { threshold: 75, collegeId } : 75).length;

  let mine: Record<string, unknown> = {};
  if (user.role === "STUDENT" && user.studentId) {
    mine = studentOverview(user.studentId);
  }
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId) {
    mine = {
      mySubjects: all(`SELECT id FROM allotments WHERE faculty_id = ?`, [user.facultyId]).length,
      mentees: one<{ c: number }>(
        "SELECT COUNT(DISTINCT student_id) as c FROM mentoring_notes WHERE faculty_id = ?",
        [user.facultyId]
      )?.c
    };
  }

  const byDept = all<{ name: string; c: number }>(
    `SELECT d.code as name, COUNT(st.id) as c
     FROM departments d
     LEFT JOIN classes c ON c.department_id = d.id
     LEFT JOIN students st ON st.class_id = c.id
     WHERE 1=1 ${scope}
     GROUP BY d.id
     ORDER BY d.code`,
    sp
  );

  let recentNotices: unknown[] = [];
  try {
    recentNotices = collegeId
      ? all(
          `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id
           WHERE IFNULL(n.college_id,'') = ? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 5`,
          [collegeId]
        )
      : isSuperAdmin(user)
        ? all(
            `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id ORDER BY n.pinned DESC, n.created_at DESC LIMIT 5`
          )
        : [];
  } catch {
    recentNotices = [];
  }

  return { students, faculty, classes, subjects, notices, attendancePct, defaulters, mine, byDept, recentNotices };
}

export function listDepartments(collegeId?: string) {
  if (collegeId) {
    return all(
      `SELECT d.*, u.name as hod_name
       FROM departments d
       LEFT JOIN faculty f ON f.id = d.hod_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE d.college_id = ?
       ORDER BY d.code`,
      [collegeId]
    );
  }
  return all(`SELECT d.*, u.name as hod_name
    FROM departments d
    LEFT JOIN faculty f ON f.id = d.hod_id
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY d.code`);
}

export function listClasses(collegeId?: string) {
  const extra = collegeId ? " WHERE d.college_id = ? " : "";
  return all(
    `SELECT c.*, d.name as department_name, d.code as department_code,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
     FROM classes c JOIN departments d ON d.id = c.department_id
     ${extra}
     ORDER BY d.code, c.division, c.name`,
    collegeId ? [collegeId] : []
  );
}

export function listSubjects(opts?: { facultyId?: string; classId?: string; collegeId?: string }) {
  let sql = `SELECT s.*, d.code as department_code, c.name as class_name,
    (SELECT u.name FROM assignments a JOIN faculty f ON f.id = a.faculty_id JOIN users u ON u.id = f.user_id WHERE a.subject_id = s.id LIMIT 1) as faculty_name
    FROM subjects s
    JOIN departments d ON d.id = s.department_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE 1=1`;
  const params: unknown[] = [];
  if (opts?.collegeId) {
    sql += " AND d.college_id = ?";
    params.push(opts.collegeId);
  }
  if (opts?.classId) {
    sql += " AND s.class_id = ?";
    params.push(opts.classId);
  }
  if (opts?.facultyId) {
    sql += ` AND s.id IN (
      SELECT subject_id FROM assignments WHERE faculty_id = ?
      UNION
      SELECT subject_id FROM allotments WHERE faculty_id = ?
    )`;
    params.push(opts.facultyId, opts.facultyId);
  }
  sql += " ORDER BY s.code";
  return all(sql, params);
}

export function listFaculty(collegeId?: string) {
  const extra = collegeId ? " WHERE (d.college_id = ? OR u.college_id = ?) " : "";
  return all(
    `SELECT f.*, u.name, u.email, u.phone, u.active, d.name as department_name, d.code as department_code
     FROM faculty f JOIN users u ON u.id = f.user_id
     LEFT JOIN departments d ON d.id = f.department_id
     ${extra}
     ORDER BY u.name`,
    collegeId ? [collegeId, collegeId] : []
  );
}

export function createDepartment(data: { code: string; name: string; collegeId: string }) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!code || !name) throw new Error("Department code and name required");
  const dup = one("SELECT id FROM departments WHERE college_id = ? AND code = ?", [data.collegeId, code]);
  if (dup) throw new Error("This branch code already exists in the college");
  const id = uid("d_");
  run("INSERT INTO departments (id, code, name, college_id) VALUES (?,?,?,?)", [id, code, name, data.collegeId]);
  return id;
}

export function facultyClassIds(facultyId: string) {
  return all<{ class_id: string }>("SELECT DISTINCT class_id FROM allotments WHERE faculty_id = ?", [facultyId]).map(
    (r) => r.class_id
  );
}

export function facultyOwnsSubject(facultyId: string, subjectId: string, batch?: string | null) {
  if (batch) {
    return !!one(
      `SELECT id FROM allotments WHERE faculty_id = ? AND subject_id = ?
         AND (kind = 'THEORY' OR IFNULL(batch,'') = ?)`,
      [facultyId, subjectId, batch]
    );
  }
  return !!one("SELECT id FROM allotments WHERE faculty_id = ? AND subject_id = ?", [facultyId, subjectId]);
}

export function studentsForFaculty(facultyId: string) {
  return all(
    `SELECT DISTINCT st.*, u.name, u.email, u.phone, u.active, c.name as class_name,
            c.division, c.year, d.code as branch_code, d.name as branch
     FROM students st
     JOIN users u ON u.id = st.user_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     JOIN allotments a ON a.class_id = st.class_id AND a.faculty_id = ?
     WHERE a.kind = 'THEORY' OR (a.kind = 'LAB' AND IFNULL(a.batch,'') = IFNULL(st.batch,''))
     ORDER BY d.code, c.division, CAST(st.roll_no AS INTEGER)`,
    [facultyId]
  );
}

export function classesForFaculty(facultyId: string) {
  return all(
    `SELECT DISTINCT c.*, d.name as department_name, d.code as department_code,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
     FROM classes c
     JOIN departments d ON d.id = c.department_id
     JOIN allotments a ON a.class_id = c.id
     WHERE a.faculty_id = ?
     ORDER BY d.code, c.division, c.name`,
    [facultyId]
  );
}

export function departmentsForFaculty(facultyId: string) {
  return all(
    `SELECT DISTINCT d.*, u.name as hod_name
     FROM departments d
     JOIN classes c ON c.department_id = d.id
     JOIN allotments a ON a.class_id = c.id
     LEFT JOIN faculty f ON f.id = d.hod_id
     LEFT JOIN users u ON u.id = f.user_id
     WHERE a.faculty_id = ?
     ORDER BY d.code`,
    [facultyId]
  );
}

export function listStudents(classId?: string, batch?: string | null, collegeId?: string) {
  let sql = `SELECT st.*, u.name, u.email, u.phone, u.active, c.name as class_name,
            c.division, c.year, d.code as branch_code, d.name as branch
     FROM students st JOIN users u ON u.id = st.user_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1`;
  const params: unknown[] = [];
  if (collegeId) {
    sql += " AND d.college_id = ?";
    params.push(collegeId);
  }
  if (classId) {
    sql += " AND st.class_id = ?";
    params.push(classId);
  }
  if (batch) {
    sql += " AND st.batch = ?";
    params.push(batch);
  }
  sql += " ORDER BY d.code, c.division, CAST(st.roll_no AS INTEGER)";
  return all(sql, params);
}

export type Allotment = {
  id: string;
  faculty_id: string;
  subject_id: string;
  class_id: string;
  batch: string | null;
  kind: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  division: string;
  year: string;
  branch_code: string;
  branch_name: string;
  faculty_name?: string;
  faculty_email?: string;
};

export function listAllotments(facultyId?: string, collegeId?: string) {
  let sql = `SELECT a.*, s.name as subject_name, s.code as subject_code,
            c.name as class_name, c.division, c.year,
            d.code as branch_code, d.name as branch_name,
            u.name as faculty_name, u.email as faculty_email
     FROM allotments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN classes c ON c.id = a.class_id
     JOIN departments d ON d.id = c.department_id
     JOIN faculty f ON f.id = a.faculty_id
     JOIN users u ON u.id = f.user_id
     WHERE 1=1`;
  const params: unknown[] = [];
  if (facultyId) {
    sql += " AND a.faculty_id = ?";
    params.push(facultyId);
  }
  if (collegeId) {
    sql += " AND d.college_id = ?";
    params.push(collegeId);
  }
  sql += " ORDER BY u.name, d.code, c.division, a.kind, a.batch";
  return all<Allotment>(sql, params);
}

export function createAllotment(data: {
  facultyId: string;
  classId: string;
  kind: "THEORY" | "LAB";
  batch?: string | null;
  subjectId?: string;
}) {
  const kind = data.kind === "LAB" ? "LAB" : "THEORY";
  const batch = kind === "LAB" ? data.batch || "B1" : null;
  let subjectId = data.subjectId;
  if (!subjectId) {
    const sub = one<{ id: string }>(
      "SELECT id FROM subjects WHERE class_id = ? AND type = ? ORDER BY code LIMIT 1",
      [data.classId, kind]
    );
    subjectId = sub?.id;
  }
  if (!subjectId) throw new Error("No subject found for this class and type");

  const dup = one<{ id: string }>(
    "SELECT id FROM allotments WHERE faculty_id = ? AND subject_id = ? AND class_id = ? AND kind = ? AND IFNULL(batch,'') = IFNULL(?, '')",
    [data.facultyId, subjectId, data.classId, kind, batch || ""]
  );
  if (dup) throw new Error("This faculty is already allotted this class");

  const id = uid("al_");
  run("INSERT INTO allotments (id, faculty_id, subject_id, class_id, batch, kind) VALUES (?,?,?,?,?,?)", [
    id,
    data.facultyId,
    subjectId,
    data.classId,
    batch,
    kind
  ]);
  const existingAsg = one<{ id: string }>("SELECT id FROM assignments WHERE faculty_id = ? AND subject_id = ?", [
    data.facultyId,
    subjectId
  ]);
  if (!existingAsg) {
    run("INSERT INTO assignments (id, faculty_id, subject_id) VALUES (?,?,?)", [uid("a_"), data.facultyId, subjectId]);
  }
  return id;
}

export function deleteAllotment(id: string) {
  run("DELETE FROM allotments WHERE id = ?", [id]);
}

export function studentsForAllotment(allotmentId: string) {
  const a = one<Allotment>(
    `SELECT a.*, s.name as subject_name, s.code as subject_code,
            c.name as class_name, c.division, c.year,
            d.code as branch_code, d.name as branch_name
     FROM allotments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN classes c ON c.id = a.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE a.id = ?`,
    [allotmentId]
  );
  if (!a) return { allotment: null, students: [] };
  const batch = a.kind === "LAB" ? a.batch : null;
  return { allotment: a, students: listStudents(a.class_id, batch) };
}

export function listUsers() {
  return all(`SELECT id, email, name, role, phone, active, created_at FROM users ORDER BY role, name`);
}

export function attendanceMatrix(subjectId: string, batch?: string | null, facultyId?: string) {
  const sessions = all<{ id: string; date: string; period: number; topic: string; batch: string }>(
    facultyId
      ? batch
        ? "SELECT * FROM attendance_sessions WHERE subject_id = ? AND faculty_id = ? AND IFNULL(batch,'') = ? ORDER BY date, period"
        : "SELECT * FROM attendance_sessions WHERE subject_id = ? AND faculty_id = ? ORDER BY date, period"
      : batch
        ? "SELECT * FROM attendance_sessions WHERE subject_id = ? AND IFNULL(batch,'') = ? ORDER BY date, period"
        : "SELECT * FROM attendance_sessions WHERE subject_id = ? ORDER BY date, period",
    facultyId ? (batch ? [subjectId, facultyId, batch] : [subjectId, facultyId]) : batch ? [subjectId, batch] : [subjectId]
  );
  const subject = one<{ class_id: string }>("SELECT class_id FROM subjects WHERE id = ?", [subjectId]);
  const students = listStudents(subject?.class_id, batch || null);
  const records = all<{ session_id: string; student_id: string; status: string }>(
    `SELECT r.session_id, r.student_id, r.status
     FROM attendance_records r
     JOIN attendance_sessions s ON s.id = r.session_id
     WHERE s.subject_id = ?`,
    [subjectId]
  );
  const map: Record<string, string> = {};
  records.forEach((r) => {
    map[`${r.student_id}:${r.session_id}`] = r.status;
  });
  return { sessions, students, map };
}

export function saveAttendance(payload: {
  subjectId: string;
  facultyId: string;
  date: string;
  period: number;
  topic?: string;
  batch?: string | null;
  records: { studentId: string; status: string }[];
}) {
  let session = one<{ id: string }>(
    "SELECT id FROM attendance_sessions WHERE subject_id = ? AND faculty_id = ? AND date = ? AND period = ? AND IFNULL(batch,'') = IFNULL(?, '')",
    [payload.subjectId, payload.facultyId, payload.date, payload.period, payload.batch || ""]
  );
  if (!session) {
    const id = uid("as_");
    run(
      "INSERT INTO attendance_sessions (id, subject_id, faculty_id, date, period, topic, batch) VALUES (?,?,?,?,?,?,?)",
      [
        id,
        payload.subjectId,
        payload.facultyId,
        payload.date,
        payload.period,
        payload.topic || null,
        payload.batch || null
      ]
    );
    session = { id };
  } else if (payload.topic) {
    run("UPDATE attendance_sessions SET topic = ? WHERE id = ?", [payload.topic, session.id]);
  }
  payload.records.forEach((r) => {
    const existing = one<{ id: string }>(
      "SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?",
      [session!.id, r.studentId]
    );
    if (existing) {
      run("UPDATE attendance_records SET status = ? WHERE id = ?", [r.status, existing.id]);
    } else {
      run("INSERT INTO attendance_records (id, session_id, student_id, status) VALUES (?,?,?,?)", [
        uid("ar_"),
        session!.id,
        r.studentId,
        r.status
      ]);
    }
  });
  return { sessionId: session.id };
}

export function attendanceSummaryForStudent(studentId: string) {
  return all<{ subject: string; code: string; present: number; total: number }>(
    `SELECT sub.name as subject, sub.code as code,
            SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) as present,
            COUNT(r.id) as total
     FROM attendance_records r
     JOIN attendance_sessions s ON s.id = r.session_id
     JOIN subjects sub ON sub.id = s.subject_id
     WHERE r.student_id = ?
     GROUP BY sub.id
     ORDER BY sub.code`,
    [studentId]
  );
}

export function defaulterList(
  opts:
    | number
    | {
        threshold?: number;
        branch?: string;
        division?: string;
        marksBelow?: number | null;
        mode?: "att" | "or" | "and";
        classIds?: string[];
        collegeId?: string;
      } = {}
) {
  if (typeof opts === "number") opts = { threshold: opts };
  const threshold = opts.threshold ?? 75;
  const params: unknown[] = [];
  let where = "";
  if (opts.collegeId) {
    where += " AND d.college_id = ?";
    params.push(opts.collegeId);
  }
  if (opts.branch) {
    where += " AND d.code = ?";
    params.push(opts.branch);
  }
  if (opts.division) {
    where += " AND c.division = ?";
    params.push(opts.division);
  }
  if (opts.classIds?.length) {
    where += ` AND c.id IN (${opts.classIds.map(() => "?").join(",")})`;
    params.push(...opts.classIds);
  }

  const rows = all<{
    student_id: string;
    name: string;
    roll_no: string;
    class_name: string;
    division: string;
    branch_code: string;
    batch: string;
    subject: string;
    code: string;
    present: number;
    total: number;
  }>(
    `SELECT st.id as student_id, u.name, st.roll_no, c.name as class_name, c.division,
            d.code as branch_code, st.batch, sub.name as subject, sub.code as code,
            SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) as present,
            COUNT(r.id) as total
     FROM attendance_records r
     JOIN students st ON st.id = r.student_id
     JOIN users u ON u.id = st.user_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     JOIN attendance_sessions s ON s.id = r.session_id
     JOIN subjects sub ON sub.id = s.subject_id
     WHERE 1=1 ${where}
     GROUP BY st.id, sub.id
     HAVING total > 0
     ORDER BY d.code, c.division, CAST(st.roll_no AS INTEGER), sub.code`,
    params
  );

  const marks = all<{ student_id: string; avg: number }>(
    `SELECT st.id as student_id, AVG(m.obtained * 100.0 / a.max_marks) as avg
     FROM students st
     JOIN marks m ON m.student_id = st.id
     JOIN assessments a ON a.id = m.assessment_id
     GROUP BY st.id`
  );
  const mmap = Object.fromEntries(marks.map((m) => [m.student_id, Number(m.avg)]));
  const mode = opts.mode || "att";
  const marksBelow = opts.marksBelow != null && opts.marksBelow > 0 ? opts.marksBelow : null;

  return rows
    .map((r) => {
      const percent = Math.round((Number(r.present) / Number(r.total)) * 1000) / 10;
      const marksPct = mmap[r.student_id] != null ? Math.round(mmap[r.student_id] * 10) / 10 : null;
      return { ...r, percent, marksPct };
    })
    .filter((r) => {
      const attFail = r.percent < threshold;
      const markFail = marksBelow != null && r.marksPct != null && r.marksPct < marksBelow;
      if (mode === "and" && marksBelow != null) return attFail && markFail;
      if (mode === "or" && marksBelow != null) return attFail || markFail;
      return attFail;
    });
}

export function listAssessments(opts?: {
  facultyId?: string;
  subjectId?: string;
  departmentId?: string;
  q?: string;
  date?: string;
  branch?: string;
}) {
  let sql = `SELECT a.*, s.name as subject_name, s.code as subject_code, u.name as faculty_name,
            c.name as class_name, c.division, d.code as branch_code, d.name as branch_name
     FROM assessments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN faculty f ON f.id = a.faculty_id
     JOIN users u ON u.id = f.user_id
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE 1=1`;
  const params: unknown[] = [];
  if (opts?.facultyId) {
    sql += " AND a.faculty_id = ?";
    params.push(opts.facultyId);
  }
  if (opts?.departmentId) {
    sql += " AND (d.id = ? OR f.department_id = ?)";
    params.push(opts.departmentId, opts.departmentId);
  }
  if (opts?.subjectId) {
    sql += " AND a.subject_id = ?";
    params.push(opts.subjectId);
  }
  if (opts?.branch) {
    sql += " AND d.code = ?";
    params.push(opts.branch);
  }
  if (opts?.date) {
    sql += " AND a.date = ?";
    params.push(opts.date);
  }
  if (opts?.q) {
    sql += " AND (a.title LIKE ? OR s.name LIKE ? OR s.code LIKE ? OR c.name LIKE ? OR a.type LIKE ?)";
    const like = `%${opts.q}%`;
    params.push(like, like, like, like, like);
  }
  sql += " ORDER BY a.date DESC, a.title, s.code";
  return all(sql, params);
}

export function marksForAssessment(assessmentId: string) {
  const assessment = one<{ batch: string | null; subject_id: string }>("SELECT * FROM assessments WHERE id = ?", [
    assessmentId
  ]);
  const subject = one<{ class_id: string }>(
    "SELECT class_id FROM subjects WHERE id = (SELECT subject_id FROM assessments WHERE id = ?)",
    [assessmentId]
  );
  const students = listStudents(subject?.class_id, assessment?.batch || null);
  const marks = all<{ student_id: string; obtained: number; remark: string }>(
    "SELECT student_id, obtained, remark FROM marks WHERE assessment_id = ?",
    [assessmentId]
  );
  const map: Record<string, { obtained: number; remark: string }> = {};
  marks.forEach((m) => {
    map[m.student_id] = { obtained: m.obtained, remark: m.remark };
  });
  return { assessment, students, map };
}

export function saveMarks(assessmentId: string, entries: { studentId: string; obtained: number; remark?: string }[]) {
  entries.forEach((e) => {
    const existing = one<{ id: string }>("SELECT id FROM marks WHERE assessment_id = ? AND student_id = ?", [
      assessmentId,
      e.studentId
    ]);
    if (existing) {
      run("UPDATE marks SET obtained = ?, remark = ? WHERE id = ?", [e.obtained, e.remark || null, existing.id]);
    } else {
      run("INSERT INTO marks (id, assessment_id, student_id, obtained, remark) VALUES (?,?,?,?,?)", [
        uid("m_"),
        assessmentId,
        e.studentId,
        e.obtained,
        e.remark || null
      ]);
    }
  });
}

export function studentMarks(studentId: string) {
  return all(
    `SELECT m.obtained, m.remark, a.title, a.type, a.max_marks, a.date, s.name as subject, s.code
     FROM marks m
     JOIN assessments a ON a.id = m.assessment_id
     JOIN subjects s ON s.id = a.subject_id
     WHERE m.student_id = ?
     ORDER BY s.code, a.type`,
    [studentId]
  );
}

export function studentOverview(studentId: string) {
  const att = attendanceSummaryForStudent(studentId);
  const overallP = att.reduce((s, r) => s + Number(r.present), 0);
  const overallT = att.reduce((s, r) => s + Number(r.total), 0);
  const marks = studentMarks(studentId) as { obtained: number; max_marks: number }[];
  const avg =
    marks.length === 0
      ? 0
      : Math.round((marks.reduce((s, m) => s + m.obtained / m.max_marks, 0) / marks.length) * 1000) / 10;
  return {
    attendancePct: overallT ? Math.round((overallP / overallT) * 1000) / 10 : 0,
    subjects: att.length,
    assessments: marks.length,
    avg
  };
}

export function listNotices(role?: string, collegeId?: string) {
  try {
    return listNoticesInner(role, collegeId);
  } catch {
    return [];
  }
}

function listNoticesInner(role?: string, collegeId?: string) {
  if (collegeId) {
    if (!role || role === "ADMIN" || role === "COLLEGE_ADMIN") {
      return all(
        `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id
         WHERE n.college_id = ?
         ORDER BY n.pinned DESC, n.created_at DESC`,
        [collegeId]
      );
    }
    return all(
      `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id
       WHERE n.college_id = ? AND (n.audience = 'ALL' OR n.audience = ?)
       ORDER BY n.pinned DESC, n.created_at DESC`,
      [collegeId, role]
    );
  }
  if (!role || role === "ADMIN") {
    return all(
      `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id ORDER BY n.pinned DESC, n.created_at DESC`
    );
  }
  return all(
    `SELECT n.*, u.name as author_name FROM notices n JOIN users u ON u.id = n.author_id
     WHERE n.audience = 'ALL' OR n.audience = ?
     ORDER BY n.pinned DESC, n.created_at DESC`,
    [role]
  );
}

export function createNotice(
  authorId: string,
  title: string,
  body: string,
  audience: string,
  pinned: boolean,
  collegeId?: string
) {
  run("INSERT INTO notices (id, title, body, audience, pinned, author_id, college_id) VALUES (?,?,?,?,?,?,?)", [
    uid("n_"),
    title,
    body,
    audience,
    pinned ? 1 : 0,
    authorId,
    collegeId || null
  ]);
}

export function listMentoring(opts?: { facultyId?: string; studentId?: string; collegeId?: string }) {
  let sql = `SELECT m.*, u.name as student_name, st.roll_no, fu.name as faculty_name, c.name as class_name
     FROM mentoring_notes m
     JOIN students st ON st.id = m.student_id
     JOIN users u ON u.id = st.user_id
     JOIN faculty f ON f.id = m.faculty_id
     JOIN users fu ON fu.id = f.user_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1`;
  const params: unknown[] = [];
  if (opts?.collegeId) {
    sql += " AND d.college_id = ?";
    params.push(opts.collegeId);
  }
  if (opts?.facultyId) {
    sql += " AND m.faculty_id = ?";
    params.push(opts.facultyId);
  }
  if (opts?.studentId) {
    sql += " AND m.student_id = ?";
    params.push(opts.studentId);
  }
  sql += " ORDER BY m.date DESC, m.created_at DESC";
  return all(sql, params);
}

export function addMentoring(data: {
  facultyId: string;
  studentId: string;
  date: string;
  category: string;
  note: string;
  followUp?: string;
}) {
  run(
    "INSERT INTO mentoring_notes (id, faculty_id, student_id, date, category, note, follow_up) VALUES (?,?,?,?,?,?,?)",
    [uid("mn_"), data.facultyId, data.studentId, data.date, data.category, data.note, data.followUp || null]
  );
}

export function timetableForClass(classId: string) {
  return all(
    `SELECT t.*, s.name as subject_name, s.code as subject_code
     FROM timetable_slots t JOIN subjects s ON s.id = t.subject_id
     WHERE t.class_id = ?
     ORDER BY t.day, t.start_time`,
    [classId]
  );
}

export function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: string;
  phone?: string;
  extra?: Record<string, string>;
}) {
  if (!data.email) throw new Error("Email is required");
  if (!data.name) throw new Error("Name is required");
  const email = data.email.toLowerCase().trim();
  if (one("SELECT id FROM users WHERE email = ?", [email])) throw new Error("That email is already in use");
  if (data.role === "STUDENT" && !data.extra?.classId) throw new Error("Select branch and division first");
  const id = uid("u_");
  run("INSERT INTO users (id, email, password_hash, name, role, phone, college_id) VALUES (?,?,?,?,?,?,?)", [
    id,
    email,
    bcrypt.hashSync(data.password || email, 10),
    data.name,
    data.role,
    data.phone || null,
    data.extra?.collegeId || null
  ]);
  if (data.role === "FACULTY" || data.role === "HOD") {
    const fid = uid("f_");
    run("INSERT INTO faculty (id, user_id, employee_id, designation, department_id, is_hod) VALUES (?,?,?,?,?,?)", [
      fid,
      id,
      data.extra?.employeeId || `EMP${Date.now().toString().slice(-6)}`,
      data.extra?.designation || "Assistant Professor",
      data.extra?.departmentId || null,
      data.role === "HOD" ? 1 : 0
    ]);
  }
  if (data.role === "STUDENT") {
    run(
      `INSERT INTO students (id, user_id, roll_no, prn, gr_no, class_id, batch, guardian_name, guardian_phone, parent_email)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        uid("st_"),
        id,
        data.extra?.rollNo || "00",
        data.extra?.prn || `PRN${Date.now()}`,
        data.extra?.grNo || null,
        data.extra?.classId,
        data.extra?.batch || null,
        data.extra?.guardianName || null,
        data.extra?.guardianPhone || null,
        data.extra?.parentEmail || null
      ]
    );
  }
  return id;
}

export function createClass(data: {
  name: string;
  year: string;
  division: string;
  semester: number;
  academicYear: string;
  departmentId: string;
}) {
  if (!data.departmentId) throw new Error("Department is required");
  const id = uid("c_");
  run("INSERT INTO classes (id, name, year, division, semester, academic_year, department_id) VALUES (?,?,?,?,?,?,?)", [
    id,
    data.name,
    data.year,
    data.division,
    data.semester,
    data.academicYear,
    data.departmentId
  ]);
  const dept = one<{ code: string }>("SELECT code FROM departments WHERE id = ?", [data.departmentId]);
  const code = (dept?.code || "GEN").replace(/[^A-Z0-9]/gi, "");
  const div = data.division || "A";
  createSubject({
    code: `${code}301${div}`,
    name: `${dept?.code || "Core"} Theory`,
    credits: 4,
    type: "THEORY",
    departmentId: data.departmentId,
    classId: id
  });
  createSubject({
    code: `${code}302${div}`,
    name: `${dept?.code || "Core"} Laboratory`,
    credits: 1,
    type: "LAB",
    departmentId: data.departmentId,
    classId: id
  });
  return id;
}

export function createSubject(data: {
  code: string;
  name: string;
  credits: number;
  type: string;
  departmentId: string;
  classId?: string;
  facultyId?: string;
}) {
  const id = uid("s_");
  run("INSERT INTO subjects (id, code, name, credits, type, department_id, class_id) VALUES (?,?,?,?,?,?,?)", [
    id,
    data.code,
    data.name,
    data.credits,
    data.type,
    data.departmentId,
    data.classId || null
  ]);
  if (data.facultyId) {
    run("INSERT INTO assignments (id, faculty_id, subject_id) VALUES (?,?,?)", [uid("a_"), data.facultyId, id]);
  }
  return id;
}

export function listSavedSessions(opts: { facultyId?: string; date?: string; q?: string; branch?: string }) {
  if (!opts.facultyId) return [];
  const params: unknown[] = [opts.facultyId];

  const attParams = [...params];
  if (opts.date) attParams.push(opts.date);
  if (opts.branch) attParams.push(opts.branch);
  if (opts.q) {
    const like = `%${opts.q}%`;
    attParams.push(like, like, like, like);
  }

  const attendance = all<{
    id: string;
    date: string;
    title: string;
    type: string;
    subject_name: string;
    subject_code: string;
    class_name: string;
    batch: string;
    kind: string;
  }>(
    `SELECT s.id, s.date, COALESCE(NULLIF(s.topic,''), sub.name) as title, 'ATTENDANCE' as type,
            sub.name as subject_name, sub.code as subject_code, c.name as class_name,
            s.batch, 'attendance' as kind
     FROM attendance_sessions s
     JOIN subjects sub ON sub.id = s.subject_id
     LEFT JOIN classes c ON c.id = sub.class_id
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE s.faculty_id = ?
       ${opts.date ? " AND s.date = ?" : ""}
       ${opts.branch ? " AND d.code = ?" : ""}
       ${opts.q ? " AND (COALESCE(s.topic,'') LIKE ? OR sub.name LIKE ? OR sub.code LIKE ? OR c.name LIKE ?)" : ""}
     ORDER BY s.date DESC, s.topic`,
    attParams
  );

  const assParams: unknown[] = [];
  if (opts.facultyId) assParams.push(opts.facultyId);
  if (opts.date) assParams.push(opts.date);
  if (opts.branch) assParams.push(opts.branch);
  if (opts.q) {
    const like = `%${opts.q}%`;
    assParams.push(like, like, like, like);
  }

  const assessments = all<{
    id: string;
    date: string;
    title: string;
    type: string;
    subject_name: string;
    subject_code: string;
    class_name: string;
    batch: string;
    kind: string;
  }>(
    `SELECT a.id, a.date, a.title, a.type,
            sub.name as subject_name, sub.code as subject_code, c.name as class_name,
            a.batch, 'assignment' as kind
     FROM assessments a
     JOIN subjects sub ON sub.id = a.subject_id
     LEFT JOIN classes c ON c.id = sub.class_id
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE a.faculty_id = ?
       ${opts.date ? " AND a.date = ?" : ""}
       ${opts.branch ? " AND d.code = ?" : ""}
       ${opts.q ? " AND (a.title LIKE ? OR sub.name LIKE ? OR sub.code LIKE ? OR c.name LIKE ?)" : ""}
     ORDER BY a.date DESC, a.title`,
    assParams
  );

  return [...attendance, ...assessments].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function attendanceSessionDetail(sessionId: string) {
  const session = one(
    `SELECT s.*, sub.name as subject_name, sub.code as subject_code, c.name as class_name
     FROM attendance_sessions s
     JOIN subjects sub ON sub.id = s.subject_id
     LEFT JOIN classes c ON c.id = sub.class_id
     WHERE s.id = ?`,
    [sessionId]
  );
  const records = all<{ student_id: string; status: string; name: string; roll_no: string }>(
    `SELECT r.student_id, r.status, u.name, st.roll_no
     FROM attendance_records r
     JOIN students st ON st.id = r.student_id
     JOIN users u ON u.id = st.user_id
     WHERE r.session_id = ?
     ORDER BY CAST(st.roll_no AS INTEGER)`,
    [sessionId]
  );
  return { kind: "attendance" as const, session, records };
}

export function createAssessment(data: {
  subjectId: string;
  facultyId: string;
  title: string;
  type: string;
  maxMarks: number;
  date?: string;
  batch?: string | null;
}) {
  if (!data.subjectId) throw new Error("Subject is required");
  const maxMarks = Number(data.maxMarks);
  if (!maxMarks || maxMarks <= 0) throw new Error("Enter total marks");
  const sub = one<{ name: string; code: string; class_name: string; division: string; branch_code: string }>(
    `SELECT s.name, s.code, c.name as class_name, c.division, d.code as branch_code
     FROM subjects s
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE s.id = ?`,
    [data.subjectId]
  );
  const batchBit = data.batch ? ` · ${data.batch}` : "";
  const title =
    (data.title || "").trim() ||
    `${data.type} — ${sub?.name || "Subject"} (${sub?.branch_code || ""} Div ${sub?.division || ""}${batchBit})`.replace(
      "()",
      ""
    );
  const id = uid("ass_");
  run(
    "INSERT INTO assessments (id, subject_id, faculty_id, title, type, max_marks, date, batch) VALUES (?,?,?,?,?,?,?,?)",
    [id, data.subjectId, data.facultyId, title, data.type, maxMarks, data.date || null, data.batch || null]
  );
  return id;
}

export function branchAnalytics(branchCode?: string, collegeId?: string) {
  const collegeFilter = collegeId ? " AND d.college_id = ? " : "";
  const branchFilter = (branchCode ? " AND d.code = ? " : "") + collegeFilter;
  const params = [...(branchCode ? [branchCode] : []), ...(collegeId ? [collegeId] : [])];
  const deptParams = collegeId ? [collegeId] : [];
  const deptSql = collegeId
    ? "SELECT code, name FROM departments WHERE college_id = ? ORDER BY code"
    : "SELECT code, name FROM departments ORDER BY code";

  const att = one<{ present: number; total: number }>(
    `SELECT
       SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) as present,
       COUNT(r.id) as total
     FROM attendance_records r
     JOIN students st ON st.id = r.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${branchFilter}`,
    params
  );
  const attendancePct = att?.total ? Math.round((Number(att.present) / Number(att.total)) * 1000) / 10 : 0;

  const prog = one<{ avg: number }>(
    `SELECT AVG(m.obtained * 100.0 / a.max_marks) as avg
     FROM marks m
     JOIN assessments a ON a.id = m.assessment_id
     JOIN students st ON st.id = m.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${branchFilter}`,
    params
  );
  const progressPct = prog?.avg ? Math.round(Number(prog.avg) * 10) / 10 : 0;

  const students =
    one<{ c: number }>(
      `SELECT COUNT(st.id) as c FROM students st
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${branchFilter}`,
      params
    )?.c ?? 0;

  const defaulters =
    one<{ c: number }>(
      `SELECT COUNT(*) as c FROM (
       SELECT st.id, sub.id
       FROM attendance_records r
       JOIN students st ON st.id = r.student_id
       JOIN classes c ON c.id = st.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN attendance_sessions s ON s.id = r.session_id
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE 1=1 ${branchFilter}
       GROUP BY st.id, sub.id
       HAVING COUNT(r.id) > 0 AND (SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) * 100.0 / COUNT(r.id)) < 75
     )`,
      params
    )?.c ?? 0;

  const byDivision = all<{ division: string; attendance: number }>(
    `SELECT c.division as division,
            ROUND(100.0 * SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) / COUNT(r.id), 1) as attendance
     FROM attendance_records r
     JOIN students st ON st.id = r.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${branchFilter}
     GROUP BY c.division
     ORDER BY c.division`,
    params
  );
  const progressByDiv = all<{ division: string; progress: number }>(
    `SELECT c.division as division,
            ROUND(AVG(m.obtained * 100.0 / a.max_marks), 1) as progress
     FROM marks m
     JOIN assessments a ON a.id = m.assessment_id
     JOIN students st ON st.id = m.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${branchFilter}
     GROUP BY c.division
     ORDER BY c.division`,
    params
  );
  const pmap = Object.fromEntries(progressByDiv.map((r) => [r.division, r.progress]));
  const divisionChart = byDivision.map((r) => ({
    name: `Div ${r.division}`,
    attendance: Number(r.attendance) || 0,
    progress: Number(pmap[r.division]) || 0
  }));

  const byBranch = all<{ code: string; attendance: number }>(
    `SELECT d.code as code,
            ROUND(100.0 * SUM(CASE WHEN r.status IN ('PRESENT','LATE','OD') THEN 1 ELSE 0 END) / COUNT(r.id), 1) as attendance
     FROM attendance_records r
     JOIN students st ON st.id = r.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${collegeFilter}
     GROUP BY d.code
     ORDER BY d.code`,
    collegeId ? [collegeId] : []
  );
  const progressByBranch = all<{ code: string; progress: number }>(
    `SELECT d.code as code,
            ROUND(AVG(m.obtained * 100.0 / a.max_marks), 1) as progress
     FROM marks m
     JOIN assessments a ON a.id = m.assessment_id
     JOIN students st ON st.id = m.student_id
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE 1=1 ${collegeFilter}
     GROUP BY d.code
     ORDER BY d.code`,
    collegeId ? [collegeId] : []
  );
  const bmap = Object.fromEntries(progressByBranch.map((r) => [r.code, r.progress]));
  const branchChart = byBranch.map((r) => ({
    name: r.code,
    attendance: Number(r.attendance) || 0,
    progress: Number(bmap[r.code]) || 0
  }));

  return {
    departments: all<{ code: string; name: string }>(deptSql, deptParams),
    attendancePct,
    progressPct,
    students,
    defaulters,
    divisionChart,
    branchChart
  };
}

export function reportBundle(collegeId?: string) {
  return {
    departments: listDepartments(collegeId),
    classes: listClasses(collegeId),
    faculty: listFaculty(collegeId),
    students: listStudents(undefined, undefined, collegeId),
    defaulters: defaulterList(collegeId ? { threshold: 75, collegeId } : 75),
    attendanceOverall: dashboardStats({
      id: "",
      email: "",
      name: "",
      role: collegeId ? "COLLEGE_ADMIN" : "ADMIN",
      collegeId
    })
  };
}
