import { NextRequest } from "next/server";
import { ensureDb, one } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createUser, listStudents, studentsForFaculty } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const classId = req.nextUrl.searchParams.get("classId") || undefined;
  const batch = req.nextUrl.searchParams.get("batch") || undefined;
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId && !classId) {
    return json(studentsForFaculty(user.facultyId));
  }
  return json(listStudents(classId, batch, collegeScope(user)));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "STUDENT") return json({ error: "Forbidden" }, 403);
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "HOD" && user.role !== "FACULTY") {
    return json({ error: "Forbidden" }, 403);
  }
  const body = await req.json();
  const scope = collegeScope(user);
  if (scope && body.classId) {
    const cls = one<{ college_id: string }>(
      `SELECT d.college_id FROM classes c JOIN departments d ON d.id = c.department_id WHERE c.id = ?`,
      [body.classId]
    );
    if (cls?.college_id && cls.college_id !== scope) return json({ error: "That class is not in your college" }, 403);
  }
  if (!body.name || !body.classId || !body.rollNo) {
    return json({ error: "Name, roll number and class are required" }, 400);
  }
  try {
    createUser({
      email: body.email,
      password: body.password || body.email,
      name: body.name,
      role: "STUDENT",
      phone: body.phone,
      extra: {
        rollNo: body.rollNo,
        prn: body.prn,
        grNo: body.grNo,
        classId: body.classId,
        batch: body.batch,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        parentEmail: body.parentEmail,
        collegeId: scope || ""
      }
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not save student" }, 400);
  }
  return json({ ok: true });
}
