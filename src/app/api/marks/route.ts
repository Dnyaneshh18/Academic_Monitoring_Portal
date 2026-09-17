import { NextRequest } from "next/server";
import { ensureDb, one } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import {
  createAssessment,
  facultyOwnsSubject,
  listAssessments,
  marksForAssessment,
  saveMarks,
  studentMarks
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const assessmentId = req.nextUrl.searchParams.get("assessmentId");
  if (user.role === "STUDENT" && user.studentId) {
    return json({ marks: studentMarks(user.studentId), assessments: [] });
  }
  if (assessmentId) {
    const facultyId = user.role === "FACULTY" || user.role === "HOD" ? user.facultyId : undefined;
    if (facultyId) {
      const row = one<{ faculty_id: string }>("SELECT faculty_id FROM assessments WHERE id = ?", [assessmentId]);
      if (row && row.faculty_id !== facultyId) return json({ error: "Forbidden" }, 403);
    }
    return json(marksForAssessment(assessmentId));
  }
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const date = req.nextUrl.searchParams.get("date") || undefined;
  const branch = req.nextUrl.searchParams.get("branch") || undefined;
  const facultyId = user.role === "FACULTY" || user.role === "HOD" ? user.facultyId : undefined;
  return json({ assessments: listAssessments({ facultyId, q, date, branch }) });
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") {
    return json({ error: "Only faculty can create assessments and enter marks" }, 403);
  }
  const body = await req.json();
  if (body.action === "create") {
    try {
      if (!user.facultyId || !facultyOwnsSubject(user.facultyId, body.subjectId, body.batch || null)) {
        return json({ error: "This class is not allotted to you" }, 403);
      }
      const id = createAssessment({
        subjectId: body.subjectId,
        facultyId: user.facultyId,
        title: body.title,
        type: body.type,
        maxMarks: Number(body.maxMarks),
        date: body.date,
        batch: body.batch || null
      });
      return json({ id });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Could not create" }, 400);
    }
  }
  saveMarks(body.assessmentId, body.entries);
  return json({ ok: true });
}
