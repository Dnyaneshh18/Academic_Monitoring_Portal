import { NextRequest } from "next/server";
import { ensureDb, all, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { facultyOwnsSubject, listStudents } from "@/lib/queries";
import { uid } from "@/lib/ids";
import { syncHomeworkFromPostgres } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function taskRow(id: string) {
  return one<{
    id: string;
    faculty_id: string;
    subject_id: string;
    class_id: string;
    batch: string | null;
    title: string;
    instructions: string;
    max_marks: number;
    due_date: string;
    subject_name: string;
    subject_code: string;
    class_name: string;
    division: string;
    branch_code: string;
    faculty_name: string;
  }>(
    `SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name, c.division,
            d.code as branch_code, u.name as faculty_name
     FROM homework_tasks t
     JOIN subjects s ON s.id = t.subject_id
     JOIN classes c ON c.id = t.class_id
     JOIN departments d ON d.id = c.department_id
     JOIN faculty f ON f.id = t.faculty_id
     JOIN users u ON u.id = f.user_id
     WHERE t.id = ?`,
    [id]
  );
}

export async function GET(req: NextRequest) {
  try {
    return await getHomework(req);
  } catch (e) {
    console.error("[homework GET]", e);
    return json({ tasks: [], error: e instanceof Error ? e.message : "Request failed" });
  }
}

async function getHomework(req: NextRequest) {
  const db = await ensureDb();
  await syncHomeworkFromPostgres(db);
  const user = await requireUser();
  if (isResponse(user)) return user;
  const taskId = req.nextUrl.searchParams.get("id");

  if (user.role === "STUDENT") {
    const st = one<{ id: string; class_id: string; batch: string }>(
      "SELECT id, class_id, batch FROM students WHERE id = ? OR user_id = ?",
      [user.studentId || "", user.id]
    );
    if (!st) return json({ tasks: [] });
    const tasks = all(
      `SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name,
              u.name as faculty_name,
              sub.id as submission_id, sub.file_name, sub.submitted_at, sub.verified, sub.obtained
       FROM homework_tasks t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       JOIN faculty f ON f.id = t.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN homework_submissions sub ON sub.task_id = t.id AND sub.student_id = ?
       WHERE t.class_id = ? AND (t.batch IS NULL OR t.batch = '' OR t.batch = ?)
       ORDER BY t.due_date DESC, t.created_at DESC`,
      [st.id, st.class_id, st.batch || ""]
    );
    return json({ tasks });
  }

  if (user.role === "COLLEGE_ADMIN" || user.role === "ADMIN") {
    const tasks = all(
      `SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name, c.division, d.code as branch_code
       FROM homework_tasks t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE (? IS NULL OR d.college_id = ?)
       ORDER BY t.created_at DESC`,
      [user.collegeId || null, user.collegeId || null]
    );
    return json({ tasks });
  }

  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ tasks: [] });

  if (taskId) {
    const task = taskRow(taskId);
    if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);
    const roster = listStudents(task.class_id, task.batch || null) as {
      id: string;
      name: string;
      roll_no: string;
      batch: string;
    }[];
    const subs = all<{ student_id: string; id: string; file_name: string; submitted_at: string; verified: number; obtained: number; remark: string }>(
      "SELECT * FROM homework_submissions WHERE task_id = ?",
      [taskId]
    );
    const smap = Object.fromEntries(subs.map((s) => [s.student_id, s]));
    const students = roster.map((s) => ({
      id: s.id,
      name: s.name,
      roll_no: s.roll_no,
      batch: s.batch,
      submission: smap[s.id] || null
    }));
    return json({ task, students });
  }

  const tasks = all(
    `SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name, c.division, d.code as branch_code
     FROM homework_tasks t
     JOIN subjects s ON s.id = t.subject_id
     JOIN classes c ON c.id = t.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE t.faculty_id = ?
     ORDER BY t.created_at DESC`,
    [user.facultyId]
  );
  return json({ tasks });
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
    if (!user.facultyId) return json({ error: "No faculty profile" }, 400);
    if (!facultyOwnsSubject(user.facultyId, body.subjectId, body.batch || null)) {
      return json({ error: "This class is not allotted to you" }, 403);
    }
    const sub = one<{ class_id: string }>("SELECT class_id FROM subjects WHERE id = ?", [body.subjectId]);
    if (!sub?.class_id) return json({ error: "Subject not found" }, 400);
    const maxMarks = Number(body.maxMarks);
    if (!body.title || !maxMarks) return json({ error: "Title and total marks are required" }, 400);
    const id = uid("hw_");
    run(
      `INSERT INTO homework_tasks (id, faculty_id, subject_id, class_id, batch, title, instructions, max_marks, due_date)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        user.facultyId,
        body.subjectId,
        sub.class_id,
        body.batch || null,
        String(body.title).trim(),
        body.instructions || null,
        maxMarks,
        body.dueDate || null
      ]
    );
    return json({ id });
  }

  if (body.action === "mark") {
    if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
    const task = one<{ faculty_id: string; max_marks: number }>("SELECT faculty_id, max_marks FROM homework_tasks WHERE id = ?", [
      body.taskId
    ]);
    if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);
    const sub = one<{ id: string }>("SELECT id FROM homework_submissions WHERE task_id = ? AND student_id = ?", [
      body.taskId,
      body.studentId
    ]);
    if (!sub) return json({ error: "Student has not submitted" }, 400);
    const obtained = Math.max(0, Math.min(Number(body.obtained), task.max_marks));
    run("UPDATE homework_submissions SET obtained = ?, verified = 1, remark = ? WHERE id = ?", [
      obtained,
      body.remark || null,
      sub.id
    ]);
    return json({ ok: true });
  }

  if (body.action === "verifyAll") {
    if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
    const task = one<{ faculty_id: string; max_marks: number }>("SELECT faculty_id, max_marks FROM homework_tasks WHERE id = ?", [
      body.taskId
    ]);
    if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);
    run("UPDATE homework_submissions SET verified = 1, obtained = ? WHERE task_id = ?", [task.max_marks, body.taskId]);
    return json({ ok: true, note: "Full marks given only to students who submitted." });
  }

  return json({ error: "Unknown action" }, 400);
}
