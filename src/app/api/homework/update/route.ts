import { NextRequest } from "next/server";
import { ensureDb, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { facultyOwnsSubject } from "@/lib/queries";
import { flushPgWrites } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
  if (!user.facultyId) return json({ error: "No faculty profile" }, 400);

  const body = await req.json().catch(() => ({}));
  const taskId = String(body.taskId || "");
  if (!taskId) return json({ error: "taskId is required" }, 400);

  const task = one<{ faculty_id: string; subject_id: string; batch: string | null }>(
    "SELECT faculty_id, subject_id, batch FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);
  if (!facultyOwnsSubject(user.facultyId, task.subject_id, task.batch)) {
    return json({ error: "This class is not allotted to you" }, 403);
  }

  const instructions = body.instructions !== undefined ? String(body.instructions).trim() || null : null;
  const modelAnswer = body.modelAnswer !== undefined ? String(body.modelAnswer).trim() || null : null;
  const keywords = body.keywords !== undefined ? String(body.keywords).trim() || null : null;
  const title = body.title !== undefined ? String(body.title).trim() : null;
  const dueDate = body.dueDate !== undefined ? String(body.dueDate).trim() || null : null;
  const maxMarks = body.maxMarks !== undefined ? Number(body.maxMarks) : null;

  run(
    `UPDATE homework_tasks SET
       instructions = COALESCE(?, instructions),
       model_answer = COALESCE(?, model_answer),
       keywords = COALESCE(?, keywords),
       title = COALESCE(?, title),
       due_date = COALESCE(?, due_date),
       max_marks = COALESCE(?, max_marks)
     WHERE id = ?`,
    [instructions, modelAnswer, keywords, title, dueDate, maxMarks, taskId]
  );

  try {
    await flushPgWrites();
  } catch (err) {
    return json({ error: `PostgreSQL publish failed: ${(err as Error).message}` }, 500);
  }
  return json({ ok: true });
}
