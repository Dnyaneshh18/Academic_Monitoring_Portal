import { NextRequest } from "next/server";
import { ensureDb, all } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope } from "@/lib/queries";
import { scoreStudents } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "ADMIN" && !user.collegeId) {
    return json({ model: { accuracy: 0 }, students: [] });
  }

  const studentId = req.nextUrl.searchParams.get("studentId") || undefined;
  const collegeId = collegeScope(user);

  if (user.role === "STUDENT") {
    return json(scoreStudents({ studentId: user.studentId, collegeId }));
  }

  let classIds: string[] | undefined;
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId) {
    classIds = all<{ class_id: string }>("SELECT DISTINCT class_id FROM allotments WHERE faculty_id = ?", [
      user.facultyId
    ]).map((r) => r.class_id);
  }

  return json(scoreStudents({ classIds, studentId, collegeId }));
}
