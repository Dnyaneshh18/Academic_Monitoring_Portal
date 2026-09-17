import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureDb, one } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sub = one<{
    id: string;
    student_id: string;
    task_id: string;
    file_name: string;
    stored_path: string;
    mime: string;
  }>("SELECT * FROM homework_submissions WHERE id = ?", [id]);
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

  if (!fs.existsSync(sub.stored_path)) return NextResponse.json({ error: "File missing" }, { status: 404 });
  const buf = fs.readFileSync(sub.stored_path);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": sub.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${sub.file_name.replace(/"/g, "")}"`
    }
  });
}
