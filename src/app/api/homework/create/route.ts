import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDb, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { facultyOwnsSubject } from "@/lib/queries";
import { uid } from "@/lib/ids";
import { flushPgWrites } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".txt", ".zip"]);

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
  if (!user.facultyId) return json({ error: "No faculty profile" }, 400);

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const subjectId = String(form.get("subjectId") || "");
  const batch = String(form.get("batch") || "") || null;
  const instructions = String(form.get("instructions") || "") || null;
  const dueDate = String(form.get("dueDate") || "") || null;
  const maxMarks = Number(form.get("maxMarks"));
  const file = form.get("brief");

  if (!title) return json({ error: "Enter an assignment title" }, 400);
  if (!maxMarks) return json({ error: "Enter total marks" }, 400);
  if (!facultyOwnsSubject(user.facultyId, subjectId, batch)) {
    return json({ error: "This class is not allotted to you" }, 403);
  }
  const sub = one<{ class_id: string }>("SELECT class_id FROM subjects WHERE id = ?", [subjectId]);
  if (!sub?.class_id) return json({ error: "Subject not found" }, 400);

  const id = uid("hw_");
  let briefName: string | null = null;
  let briefPath: string | null = null;
  let briefData: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED.has(ext)) return json({ error: "Assignment file: PDF, Word, PPT, Excel, image, TXT or ZIP" }, 400);
    if (file.size > 15 * 1024 * 1024) return json({ error: "File must be under 15 MB" }, 400);
    briefName = (file.name || "assignment.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    briefData = Buffer.from(await file.arrayBuffer());
    if (!process.env.VERCEL) {
      const dir = path.join(process.cwd(), "data", "uploads", "briefs");
      fs.mkdirSync(dir, { recursive: true });
      briefPath = path.join(dir, `${id}${ext}`);
      fs.writeFileSync(briefPath, briefData);
      briefData = null;
    }
  }

  run(
    `INSERT INTO homework_tasks (id, faculty_id, subject_id, class_id, batch, title, instructions, max_marks, due_date, brief_name, brief_path, brief_data)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, user.facultyId, subjectId, sub.class_id, batch, title, instructions, maxMarks, dueDate, briefName, briefPath, briefData]
  );
  try {
    await flushPgWrites();
  } catch (err) {
    return json({ error: `PostgreSQL publish failed: ${(err as Error).message}` }, 500);
  }
  return json({ id });
}
