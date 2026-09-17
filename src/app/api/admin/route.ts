import { NextRequest } from "next/server";
import fs from "fs";
import { ensureDb, all, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export const runtime = "nodejs";

function adminOnly(user: { role: string }) {
  return user.role === "ADMIN" || user.role === "COLLEGE_ADMIN";
}

function ownedByCollege(collegeId: string | undefined, sql: string, id: string) {
  if (!collegeId) return true;
  return !!one(sql, [id, collegeId]);
}

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!adminOnly(user)) return json({ error: "Admin only" }, 403);
  const tab = req.nextUrl.searchParams.get("tab") || "students";
  const collegeId = user.role === "ADMIN" && !user.collegeId ? undefined : user.collegeId;
  const col = collegeId ? " AND d.college_id = ? " : "";
  const colP = collegeId ? [collegeId] : [];
  if (tab === "students") {
    return json({
      rows: all(
        `SELECT st.id, d.code as branch, c.division as div, st.batch, st.roll_no, st.gr_no, u.name,
                u.phone as mobile, st.guardian_name as parent, st.guardian_phone as parent_mobile, st.parent_email,
                u.email, st.prn, c.id as class_id
         FROM students st JOIN users u ON u.id = st.user_id
         JOIN classes c ON c.id = st.class_id JOIN departments d ON d.id = c.department_id
         WHERE 1=1 ${col}
         ORDER BY d.code, c.division, CAST(st.roll_no AS INTEGER)`,
        colP
      )
    });
  }
  if (tab === "faculty") {
    return json({
      rows: all(
        `SELECT f.id, u.name, u.email, u.phone, f.employee_id, f.designation, f.is_hod, d.code as branch_code, u.id as user_id
         FROM faculty f JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id
         WHERE 1=1 ${collegeId ? " AND (d.college_id = ? OR u.college_id = ?) " : ""}
         ORDER BY u.name`,
        collegeId ? [collegeId, collegeId] : []
      )
    });
  }
  if (tab === "classes") {
    return json({
      rows: all(
        `SELECT c.*, d.code as branch_code, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
         FROM classes c JOIN departments d ON d.id = c.department_id WHERE 1=1 ${col} ORDER BY d.code, c.division`,
        colP
      )
    });
  }
  if (tab === "subjects") {
    return json({
      rows: all(
        `SELECT s.id, s.code, s.name, s.type, c.name as class_name, d.code as branch_code
         FROM subjects s JOIN departments d ON d.id = s.department_id LEFT JOIN classes c ON c.id = s.class_id
         WHERE 1=1 ${col}
         ORDER BY s.code`,
        colP
      )
    });
  }
  if (tab === "allotments") {
    return json({
      rows: all(
        `SELECT a.id, u.name as faculty_name, d.code as branch_code, c.division, a.kind, a.batch, s.code as subject_code, s.name as subject_name
         FROM allotments a JOIN faculty f ON f.id = a.faculty_id JOIN users u ON u.id = f.user_id
         JOIN classes c ON c.id = a.class_id JOIN departments d ON d.id = c.department_id
         JOIN subjects s ON s.id = a.subject_id WHERE 1=1 ${col} ORDER BY u.name, d.code`,
        colP
      )
    });
  }
  if (tab === "homework") {
    return json({
      rows: all(
        `SELECT t.id, t.title, t.due_date, t.max_marks, t.batch, s.code as subject_code, c.name as class_name, u.name as faculty_name
         FROM homework_tasks t JOIN subjects s ON s.id = t.subject_id JOIN classes c ON c.id = t.class_id
         JOIN faculty f ON f.id = t.faculty_id JOIN users u ON u.id = f.user_id
         JOIN departments d ON d.id = c.department_id WHERE 1=1 ${col}
         ORDER BY t.created_at DESC`,
        colP
      )
    });
  }
  if (tab === "assessments") {
    return json({
      rows: all(
        `SELECT a.id, a.title, a.type, a.max_marks, a.date, s.code as subject_code, u.name as faculty_name
         FROM assessments a JOIN subjects s ON s.id = a.subject_id JOIN faculty f ON f.id = a.faculty_id JOIN users u ON u.id = f.user_id
         LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN departments d ON d.id = c.department_id
         WHERE 1=1 ${col}
         ORDER BY a.date DESC`,
        colP
      )
    });
  }
  if (tab === "sessions") {
    return json({
      rows: all(
        `SELECT s.id, s.date, s.topic, s.batch, sub.code as subject_code, u.name as faculty_name
         FROM attendance_sessions s JOIN subjects sub ON sub.id = s.subject_id
         JOIN faculty f ON f.id = s.faculty_id JOIN users u ON u.id = f.user_id
         LEFT JOIN classes c ON c.id = sub.class_id LEFT JOIN departments d ON d.id = c.department_id
         WHERE 1=1 ${col}
         ORDER BY s.date DESC LIMIT 400`,
        colP
      )
    });
  }
  if (tab === "notices") {
    return json({
      rows: collegeId
        ? all(
            "SELECT id, title, audience, pinned, created_at FROM notices WHERE college_id = ? ORDER BY created_at DESC",
            [collegeId]
          )
        : all("SELECT id, title, audience, pinned, created_at FROM notices ORDER BY created_at DESC")
    });
  }
  return json({ rows: [] });
}

export async function PATCH(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!adminOnly(user)) return json({ error: "Admin only" }, 403);
  const body = await req.json();
  const tab = body.tab as string;
  const id = body.id as string;
  if (!id) return json({ error: "id required" }, 400);

  if (tab === "students") {
    const st = one<{ user_id: string }>("SELECT user_id FROM students WHERE id = ?", [id]);
    if (!st) return json({ error: "Not found" }, 404);
    if (body.name) run("UPDATE users SET name = ? WHERE id = ?", [body.name, st.user_id]);
    if (body.email) run("UPDATE users SET email = ? WHERE id = ?", [String(body.email).toLowerCase(), st.user_id]);
    if (body.phone !== undefined) run("UPDATE users SET phone = ? WHERE id = ?", [body.phone || null, st.user_id]);
    if (body.roll_no) run("UPDATE students SET roll_no = ? WHERE id = ?", [body.roll_no, id]);
    if (body.prn) run("UPDATE students SET prn = ? WHERE id = ?", [body.prn, id]);
    if (body.batch !== undefined) run("UPDATE students SET batch = ? WHERE id = ?", [body.batch || null, id]);
    if (body.parent_email !== undefined) run("UPDATE students SET parent_email = ? WHERE id = ?", [body.parent_email || null, id]);
    if (body.guardian_name !== undefined) run("UPDATE students SET guardian_name = ? WHERE id = ?", [body.guardian_name || null, id]);
    if (body.parent_mobile !== undefined) run("UPDATE students SET guardian_phone = ? WHERE id = ?", [body.parent_mobile || null, id]);
    if (body.class_id) run("UPDATE students SET class_id = ? WHERE id = ?", [body.class_id, id]);
    return json({ ok: true });
  }
  if (tab === "faculty") {
    const f = one<{ user_id: string }>("SELECT user_id FROM faculty WHERE id = ?", [id]);
    if (!f) return json({ error: "Not found" }, 404);
    if (body.name) run("UPDATE users SET name = ? WHERE id = ?", [body.name, f.user_id]);
    if (body.email) run("UPDATE users SET email = ? WHERE id = ?", [String(body.email).toLowerCase(), f.user_id]);
    if (body.phone !== undefined) run("UPDATE users SET phone = ? WHERE id = ?", [body.phone || null, f.user_id]);
    if (body.designation) run("UPDATE faculty SET designation = ? WHERE id = ?", [body.designation, id]);
    if (body.employee_id) run("UPDATE faculty SET employee_id = ? WHERE id = ?", [body.employee_id, id]);
    return json({ ok: true });
  }
  if (tab === "notices") {
    if (body.title) run("UPDATE notices SET title = ? WHERE id = ?", [body.title, id]);
    if (body.body) run("UPDATE notices SET body = ? WHERE id = ?", [body.body, id]);
    if (body.pinned !== undefined) run("UPDATE notices SET pinned = ? WHERE id = ?", [body.pinned ? 1 : 0, id]);
    return json({ ok: true });
  }
  if (tab === "homework") {
    if (body.title) run("UPDATE homework_tasks SET title = ? WHERE id = ?", [body.title, id]);
    if (body.due_date !== undefined) run("UPDATE homework_tasks SET due_date = ? WHERE id = ?", [body.due_date || null, id]);
    if (body.max_marks) run("UPDATE homework_tasks SET max_marks = ? WHERE id = ?", [Number(body.max_marks), id]);
    return json({ ok: true });
  }
  return json({ error: "Cannot edit this type" }, 400);
}

export async function DELETE(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!adminOnly(user)) return json({ error: "Admin only" }, 403);
  const tab = req.nextUrl.searchParams.get("tab") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return json({ error: "id required" }, 400);
  const collegeId = user.role === "ADMIN" && !user.collegeId ? undefined : user.collegeId;
  if (
    tab === "students" &&
    !ownedByCollege(
      collegeId,
      `SELECT st.id FROM students st JOIN classes c ON c.id = st.class_id JOIN departments d ON d.id = c.department_id WHERE st.id = ? AND d.college_id = ?`,
      id
    )
  ) {
    return json({ error: "Not in your college" }, 403);
  }

  if (tab === "students") {
    const st = one<{ user_id: string }>("SELECT user_id FROM students WHERE id = ?", [id]);
    if (!st) return json({ error: "Not found" }, 404);
    run("DELETE FROM attendance_records WHERE student_id = ?", [id]);
    run("DELETE FROM marks WHERE student_id = ?", [id]);
    run("DELETE FROM mentoring_notes WHERE student_id = ?", [id]);
    run("DELETE FROM parent_alerts WHERE student_id = ?", [id]);
    const files = all<{ stored_path: string }>("SELECT stored_path FROM homework_submissions WHERE student_id = ?", [id]);
    files.forEach((f) => {
      try {
        fs.unlinkSync(f.stored_path);
      } catch {
        /* ignore */
      }
    });
    run("DELETE FROM homework_submissions WHERE student_id = ?", [id]);
    run("DELETE FROM students WHERE id = ?", [id]);
    run("DELETE FROM users WHERE id = ?", [st.user_id]);
    return json({ ok: true });
  }

  if (tab === "faculty") {
    const f = one<{ user_id: string }>("SELECT user_id FROM faculty WHERE id = ?", [id]);
    if (!f) return json({ error: "Not found" }, 404);
    if (f.user_id === user.id) return json({ error: "You cannot delete your own admin account this way" }, 400);
    run("DELETE FROM allotments WHERE faculty_id = ?", [id]);
    run("DELETE FROM assignments WHERE faculty_id = ?", [id]);
    const hws = all<{ id: string; brief_path: string }>("SELECT id, brief_path FROM homework_tasks WHERE faculty_id = ?", [id]);
    hws.forEach((h) => {
      const files = all<{ stored_path: string }>("SELECT stored_path FROM homework_submissions WHERE task_id = ?", [h.id]);
      files.forEach((x) => {
        try {
          fs.unlinkSync(x.stored_path);
        } catch {
          /* ignore */
        }
      });
      if (h.brief_path) {
        try {
          fs.unlinkSync(h.brief_path);
        } catch {
          /* ignore */
        }
      }
      run("DELETE FROM homework_submissions WHERE task_id = ?", [h.id]);
    });
    run("DELETE FROM homework_tasks WHERE faculty_id = ?", [id]);
    const sess = all<{ id: string }>("SELECT id FROM attendance_sessions WHERE faculty_id = ?", [id]);
    sess.forEach((s) => run("DELETE FROM attendance_records WHERE session_id = ?", [s.id]));
    run("DELETE FROM attendance_sessions WHERE faculty_id = ?", [id]);
    const ass = all<{ id: string }>("SELECT id FROM assessments WHERE faculty_id = ?", [id]);
    ass.forEach((a) => run("DELETE FROM marks WHERE assessment_id = ?", [a.id]));
    run("DELETE FROM assessments WHERE faculty_id = ?", [id]);
    run("DELETE FROM mentoring_notes WHERE faculty_id = ?", [id]);
    run("DELETE FROM faculty WHERE id = ?", [id]);
    run("DELETE FROM users WHERE id = ?", [f.user_id]);
    return json({ ok: true });
  }

  if (tab === "allotments") {
    run("DELETE FROM allotments WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "homework") {
    const t = one<{ brief_path: string }>("SELECT brief_path FROM homework_tasks WHERE id = ?", [id]);
    const files = all<{ stored_path: string }>("SELECT stored_path FROM homework_submissions WHERE task_id = ?", [id]);
    files.forEach((f) => {
      try {
        fs.unlinkSync(f.stored_path);
      } catch {
        /* ignore */
      }
    });
    if (t?.brief_path) {
      try {
        fs.unlinkSync(t.brief_path);
      } catch {
        /* ignore */
      }
    }
    run("DELETE FROM homework_submissions WHERE task_id = ?", [id]);
    run("DELETE FROM homework_tasks WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "assessments") {
    run("DELETE FROM marks WHERE assessment_id = ?", [id]);
    run("DELETE FROM assessments WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "sessions") {
    run("DELETE FROM attendance_records WHERE session_id = ?", [id]);
    run("DELETE FROM attendance_sessions WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "notices") {
    run("DELETE FROM notices WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "subjects") {
    const sess = all<{ id: string }>("SELECT id FROM attendance_sessions WHERE subject_id = ?", [id]);
    sess.forEach((s) => run("DELETE FROM attendance_records WHERE session_id = ?", [s.id]));
    run("DELETE FROM attendance_sessions WHERE subject_id = ?", [id]);
    const ass = all<{ id: string }>("SELECT id FROM assessments WHERE subject_id = ?", [id]);
    ass.forEach((a) => run("DELETE FROM marks WHERE assessment_id = ?", [a.id]));
    run("DELETE FROM assessments WHERE subject_id = ?", [id]);
    const hws = all<{ id: string }>("SELECT id FROM homework_tasks WHERE subject_id = ?", [id]);
    hws.forEach((h) => {
      run("DELETE FROM homework_submissions WHERE task_id = ?", [h.id]);
    });
    run("DELETE FROM homework_tasks WHERE subject_id = ?", [id]);
    run("DELETE FROM allotments WHERE subject_id = ?", [id]);
    run("DELETE FROM assignments WHERE subject_id = ?", [id]);
    run("DELETE FROM subjects WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (tab === "classes") {
    const n = one<{ c: number }>("SELECT COUNT(*) as c FROM students WHERE class_id = ?", [id]);
    if (n && n.c > 0) return json({ error: "Move or delete students in this class first" }, 400);
    run("DELETE FROM subjects WHERE class_id = ?", [id]);
    run("DELETE FROM classes WHERE id = ?", [id]);
    return json({ ok: true });
  }
  return json({ error: "Unknown tab" }, 400);
}
