import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureDb, one } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { pgQuery } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  let sub = one<{
    id: string;
    student_id: string;
    task_id: string;
    file_name: string;
    stored_path: string;
    file_data: Buffer | null;
    mime: string;
  }>("SELECT * FROM homework_submissions WHERE id = ?", [id]);
  if (!sub) {
    const pgSub = await pgQuery("SELECT id, student_id, task_id, file_name, stored_path, file_data, mime FROM homework_submissions WHERE id = ?", [id]);
    sub = pgSub?.rows[0] as typeof sub;
  }
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "STUDENT") {
    const st = one<{ id: string }>("SELECT id FROM students WHERE id = ? OR user_id = ?", [user.studentId || "", user.id]);
    if (!st || st.id !== sub.student_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (user.role === "FACULTY" || user.role === "HOD") {
    const task = one<{ faculty_id: string }>("SELECT faculty_id FROM homework_tasks WHERE id = ?", [sub.task_id]);
    if (!task || task.faculty_id !== user.facultyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pgFile = await pgQuery("SELECT file_data, file_name, mime FROM homework_submissions WHERE id = ?", [id]);
  const pgRow = pgFile?.rows[0] as { file_data: Buffer | null; file_name: string; mime: string | null } | undefined;
  const buf =
    pgRow?.file_data ||
    sub.file_data ||
    (sub.stored_path && fs.existsSync(sub.stored_path) ? fs.readFileSync(sub.stored_path) : null);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": pgRow?.mime || sub.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(pgRow?.file_name || sub.file_name).replace(/"/g, "")}"`
    }
  });
}
