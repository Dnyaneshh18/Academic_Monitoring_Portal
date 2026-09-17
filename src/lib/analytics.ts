import type { DatabaseSync } from "node:sqlite";
import { uid } from "./ids";

export function ensureAnalytics(db: DatabaseSync) {
  const flag = db.prepare("SELECT value FROM meta WHERE key = 'analytics_seed'").get() as { value: string } | undefined;
  if (flag?.value === "1") return;
  const n = db.prepare("SELECT COUNT(*) as c FROM attendance_records").get() as { c: number };
  if (n.c > 0) {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('analytics_seed', '1')").run();
    return;
  }

  const fallbackFac = db.prepare("SELECT id FROM faculty LIMIT 1").get() as { id: string } | undefined;
  if (!fallbackFac) return;

  const subjects = db
    .prepare("SELECT id, class_id, name FROM subjects WHERE type = 'THEORY'")
    .all() as { id: string; class_id: string; name: string }[];
  const allotBySubject = new Map<string, string>();
  (db.prepare("SELECT subject_id, faculty_id FROM allotments WHERE kind = 'THEORY'").all() as {
    subject_id: string;
    faculty_id: string;
  }[]).forEach((a) => {
    if (!allotBySubject.has(a.subject_id)) allotBySubject.set(a.subject_id, a.faculty_id);
  });
  const studentsByClass = new Map<string, string[]>();
  const stuRows = db.prepare("SELECT id, class_id FROM students").all() as { id: string; class_id: string }[];
  stuRows.forEach((s) => {
    const arr = studentsByClass.get(s.class_id) || [];
    arr.push(s.id);
    studentsByClass.set(s.class_id, arr);
  });

  const insSess = db.prepare(
    "INSERT INTO attendance_sessions (id, subject_id, faculty_id, date, period, topic, batch) VALUES (?,?,?,?,?,?,NULL)"
  );
  const insRec = db.prepare("INSERT INTO attendance_records (id, session_id, student_id, status) VALUES (?,?,?,?)");
  const insAss = db.prepare(
    "INSERT INTO assessments (id, subject_id, faculty_id, title, type, max_marks, date, batch) VALUES (?,?,?,?,?,?,?,NULL)"
  );
  const insMark = db.prepare("INSERT INTO marks (id, assessment_id, student_id, obtained, remark) VALUES (?,?,?,?,NULL)");

  db.exec("BEGIN");
  subjects.forEach((sub, si) => {
    const students = studentsByClass.get(sub.class_id) || [];
    if (!students.length) return;
    const facId = allotBySubject.get(sub.id);
    if (!facId) return;
    for (let d = 1; d <= 4; d++) {
      const date = `2026-08-${String(10 + d).padStart(2, "0")}`;
      const sess = uid("as_");
      insSess.run(sess, sub.id, facId, date, 1, sub.name);
      students.forEach((st, i) => {
        const weak = (si + i + d) % 6 === 0;
        insRec.run(uid("ar_"), sess, st, weak ? "ABSENT" : "PRESENT");
      });
    }
    const aid = uid("ass_");
    const cls = db.prepare("SELECT name FROM classes WHERE id = ?").get(sub.class_id) as { name: string } | undefined;
    const title = `UT1 — ${sub.name} (${cls?.name || "class"})`;
    insAss.run(aid, sub.id, facId, title, "UT1", 30, "2026-08-20");
    students.forEach((st, i) => {
      const score = 14 + ((si * 3 + i * 5) % 16);
      insMark.run(uid("m_"), aid, st, score);
    });
  });
  const dn = db
    .prepare(
      `SELECT st.id as student_id, st.class_id, s.id as subject_id, a.faculty_id
       FROM students st
       JOIN subjects s ON s.class_id = st.class_id AND s.type = 'THEORY'
       JOIN allotments a ON a.subject_id = s.id AND a.kind = 'THEORY'
       WHERE st.prn = '12312939'
       LIMIT 1`
    )
    .get() as { student_id: string; class_id: string; subject_id: string; faculty_id: string } | undefined;
  if (dn) {
    const sessRows = db
      .prepare("SELECT id FROM attendance_sessions WHERE subject_id = ? AND faculty_id = ?")
      .all(dn.subject_id, dn.faculty_id) as { id: string }[];
    sessRows.forEach((s, i) => {
      const existing = db
        .prepare("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?")
        .get(s.id, dn.student_id) as { id: string } | undefined;
      const status = i === 0 ? "PRESENT" : "ABSENT";
      if (existing) {
        db.prepare("UPDATE attendance_records SET status = ? WHERE id = ?").run(status, existing.id);
      } else {
        db.prepare("INSERT INTO attendance_records (id, session_id, student_id, status) VALUES (?,?,?,?)").run(
          uid("ar_"),
          s.id,
          dn.student_id,
          status
        );
      }
    });
    const ut1 = uid("ass_");
    const ut2 = uid("ass_");
    insAss.run(ut1, dn.subject_id, dn.faculty_id, "UT1 — DSA (Dnyaneshwar test)", "UT1", 50, "2026-08-05");
    insAss.run(ut2, dn.subject_id, dn.faculty_id, "UT2 — DSA (Dnyaneshwar test)", "UT2", 50, "2026-08-18");
    insMark.run(uid("m_"), ut1, dn.student_id, 20);
    insMark.run(uid("m_"), ut2, dn.student_id, 15);
  }

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('analytics_seed', '1')").run();
  db.exec("COMMIT");
}
