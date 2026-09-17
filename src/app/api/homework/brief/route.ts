import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureDb, one } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const id = req.nextUrl.searchParams.get("id");
  const task = one<{
    id: string;
    faculty_id: string;
    class_id: string;
    batch: string | null;
    brief_name: string | null;
    brief_path: string | null;
    brief_data: Buffer | null;
  }>("SELECT * FROM homework_tasks WHERE id = ?", [id]);
  if (!task?.brief_path && !task?.brief_data) return NextResponse.json({ error: "No assignment file" }, { status: 404 });

  if (user.role === "STUDENT") {
    const st = one<{ id: string; class_id: string; batch: string }>(
      "SELECT id, class_id, batch FROM students WHERE id = ? OR user_id = ?",
      [user.studentId || "", user.id]
    );
    if (!st || st.class_id !== task.class_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (task.batch && task.batch !== st.batch) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (user.role === "FACULTY" || user.role === "HOD") {
    if (task.faculty_id !== user.facultyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buf = task.brief_data || (task.brief_path && fs.existsSync(task.brief_path) ? fs.readFileSync(task.brief_path) : null);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  const name = task.brief_name || "assignment.pdf";
  const inline = req.nextUrl.searchParams.get("inline") === "1" || name.toLowerCase().endsWith(".pdf") || name.toLowerCase().match(/\.(png|jpg|jpeg|gif)$/);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : name.toLowerCase().match(/\.(png|jpg|jpeg|gif)$/)
          ? `image/${name.split(".").pop()}`
          : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`
    }
  });
}
