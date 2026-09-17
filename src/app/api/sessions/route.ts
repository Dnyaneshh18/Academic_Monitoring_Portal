import { NextRequest } from "next/server";
import { ensureDb, one } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { attendanceSessionDetail, listSavedSessions, marksForAssessment } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "STUDENT") return json({ error: "Forbidden" }, 403);

  const facultyId = user.role === "FACULTY" || user.role === "HOD" ? user.facultyId : undefined;
  if ((user.role === "FACULTY" || user.role === "HOD") && !facultyId) return json([]);

  const id = req.nextUrl.searchParams.get("id");
  const kind = req.nextUrl.searchParams.get("kind");
  if (id && kind === "attendance") {
    const data = attendanceSessionDetail(id);
    const sess = data.session as { faculty_id?: string } | undefined;
    if (facultyId && sess?.faculty_id && sess.faculty_id !== facultyId) {
      return json({ error: "Forbidden" }, 403);
    }
    return json(data);
  }
  if (id && kind === "assignment") {
    const row = one<{ faculty_id: string }>("SELECT faculty_id FROM assessments WHERE id = ?", [id]);
    if (facultyId && row && row.faculty_id !== facultyId) return json({ error: "Forbidden" }, 403);
    return json({ kind: "assignment", ...marksForAssessment(id) });
  }

  const date = req.nextUrl.searchParams.get("date") || undefined;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const branch = req.nextUrl.searchParams.get("branch") || undefined;
  return json(listSavedSessions({ facultyId, date, q, branch }));
}
