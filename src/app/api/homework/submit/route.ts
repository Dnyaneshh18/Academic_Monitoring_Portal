import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDb, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { uid } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".txt",
  ".zip"
]);

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "STUDENT") return json({ error: "Only students can upload" }, 403);
  const st = one<{ id: string; class_id: string; batch: string }>(
    "SELECT id, class_id, batch FROM students WHERE id = ? OR user_id = ?",
    [user.studentId || "", user.id]
  );
  if (!st) return json({ error: "Student profile missing" }, 400);

  const form = await req.formData();
  const taskId = String(form.get("taskId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file" }, 400);
  const task = one<{ id: string; class_id: string; batch: string | null; due_date: string }>(
    "SELECT * FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  if (!task) return json({ error: "Assignment not found" }, 404);
  if (task.class_id !== st.class_id) return json({ error: "This assignment is not for your class" }, 403);
  if (task.batch && task.batch !== st.batch) return json({ error: "This assignment is not for your batch" }, 403);
  if (task.due_date && task.due_date < new Date().toISOString().slice(0, 10)) {
    return json({ error: "Due date has passed" }, 400);
  }
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED.has(ext)) return json({ error: "Allowed: PDF, Word, PPT, Excel, images, TXT, ZIP" }, 400);
  if (file.size > 15 * 1024 * 1024) return json({ error: "File must be under 15 MB" }, 400);

  const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(process.cwd(), "data", "uploads", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${st.id}-${uid("f_")}${ext}`;
  const storedPath = path.join(dir, stored);
  fs.writeFileSync(storedPath, Buffer.from(await file.arrayBuffer()));

  const existing = one<{ id: string; stored_path: string }>(
    "SELECT id, stored_path FROM homework_submissions WHERE task_id = ? AND student_id = ?",
    [taskId, st.id]
  );
  if (existing) {
    try {
      fs.unlinkSync(existing.stored_path);
    } catch {
      /* ignore */
    }
    run(
      `UPDATE homework_submissions SET file_name = ?, stored_path = ?, mime = ?, size = ?, submitted_at = datetime('now'), verified = 0, obtained = NULL
       WHERE id = ?`,
      [safe, storedPath, file.type || null, file.size, existing.id]
    );
  } else {
    run(
      `INSERT INTO homework_submissions (id, task_id, student_id, file_name, stored_path, mime, size)
       VALUES (?,?,?,?,?,?,?)`,
      [uid("hs_"), taskId, st.id, safe, storedPath, file.type || null, file.size]
    );
  }
  return json({ ok: true });
}
