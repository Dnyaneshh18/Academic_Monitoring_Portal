import { NextRequest } from "next/server";
import { ensureDb, one } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { addMentoring, collegeScope, listMentoring } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentInCollege(studentId: string, collegeId: string) {
  return !!one(
    `SELECT st.id FROM students st
     JOIN classes c ON c.id = st.class_id
     JOIN departments d ON d.id = c.department_id
     WHERE st.id = ? AND d.college_id = ?`,
    [studentId, collegeId]
  );
}

export async function GET() {
  try {
    await ensureDb();
    const user = await requireUser();
    if (isResponse(user)) return user;
    const collegeId = collegeScope(user);
    if (user.role === "STUDENT") return json(listMentoring({ studentId: user.studentId, collegeId }));
    if (user.role === "FACULTY") return json(listMentoring({ facultyId: user.facultyId, collegeId }));
    return json(listMentoring({ collegeId }));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Mentoring failed" }, 500);
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "STUDENT") return json({ error: "Forbidden" }, 403);
  const body = await req.json();
  const collegeId = collegeScope(user);
  if (collegeId && body.studentId && !studentInCollege(String(body.studentId), collegeId)) {
    return json({ error: "That student is not in your college" }, 403);
  }
  let facultyId = user.facultyId || body.facultyId;
  if (!facultyId && collegeId) {
    const fac = one<{ id: string }>(
      `SELECT f.id FROM faculty f JOIN users u ON u.id = f.user_id WHERE u.college_id = ? LIMIT 1`,
      [collegeId]
    );
    facultyId = fac?.id;
  }
  if (!facultyId) return json({ error: "Add a faculty member in your college before saving mentoring notes" }, 400);
  addMentoring({
    facultyId,
    studentId: body.studentId,
    date: body.date,
    category: body.category,
    note: body.note,
    followUp: body.followUp
  });
  return json({ ok: true });
}
