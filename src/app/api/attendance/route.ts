import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { attendanceMatrix, attendanceSummaryForStudent, facultyOwnsSubject, saveAttendance } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const subjectId = req.nextUrl.searchParams.get("subjectId");
  if (user.role === "STUDENT" && user.studentId) {
    return json({ summary: attendanceSummaryForStudent(user.studentId) });
  }
  if (!subjectId) return json({ error: "subjectId required" }, 400);
  const batch = req.nextUrl.searchParams.get("batch") || undefined;
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId) {
    if (!facultyOwnsSubject(user.facultyId, subjectId, batch || null)) {
      return json({ error: "This class is not allotted to you" }, 403);
    }
  }
  return json(attendanceMatrix(subjectId, batch, user.facultyId));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") {
    return json({ error: "Only faculty can mark attendance" }, 403);
  }
  const body = await req.json();
  if (!user.facultyId) return json({ error: "No faculty profile" }, 400);
  if (!facultyOwnsSubject(user.facultyId, body.subjectId, body.batch || null)) {
    return json({ error: "This class is not allotted to you" }, 403);
  }
  saveAttendance({ ...body, facultyId: user.facultyId, batch: body.batch || null });
  return json({ ok: true });
}
