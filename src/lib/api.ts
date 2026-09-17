import { NextResponse } from "next/server";
import { readSession, type SessionUser } from "./auth";
import { one } from "./db";
import { flushPgWrites } from "./postgres";

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await readSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "FACULTY" || user.role === "HOD") {
    const fac = one<{ id: string; department_id: string }>("SELECT id, department_id FROM faculty WHERE user_id = ?", [
      user.id
    ]);
    if (fac) {
      user.facultyId = fac.id;
      user.departmentId = fac.department_id;
    } else {
      user.facultyId = undefined;
    }
  }
  const row = one<{ college_id: string; role: string; college_name?: string; college_code?: string }>(
    `SELECT u.college_id, u.role, c.name as college_name, c.code as college_code
     FROM users u LEFT JOIN colleges c ON c.id = u.college_id WHERE u.id = ?`,
    [user.id]
  );
  if (row) {
    user.collegeId = row.college_id || undefined;
    user.role = row.role as SessionUser["role"];
    user.collegeName = row.college_name || undefined;
    user.collegeCode = row.college_code || undefined;
  }
  if (!user.collegeId && user.role === "STUDENT") {
    const fromClass = one<{ college_id: string; name: string; code: string }>(
      `SELECT d.college_id, col.name, col.code
       FROM students st JOIN classes cl ON cl.id = st.class_id
       JOIN departments d ON d.id = cl.department_id
       LEFT JOIN colleges col ON col.id = d.college_id
       WHERE st.user_id = ?`,
      [user.id]
    );
    if (fromClass?.college_id) {
      user.collegeId = fromClass.college_id;
      user.collegeName = fromClass.name;
      user.collegeCode = fromClass.code;
    }
  }
  if (!user.collegeId && (user.role === "FACULTY" || user.role === "HOD")) {
    const fromDept = one<{ college_id: string; name: string; code: string }>(
      `SELECT d.college_id, col.name, col.code
       FROM faculty f JOIN departments d ON d.id = f.department_id
       LEFT JOIN colleges col ON col.id = d.college_id
       WHERE f.user_id = ?`,
      [user.id]
    );
    if (fromDept?.college_id) {
      user.collegeId = fromDept.college_id;
      user.collegeName = fromDept.name;
      user.collegeCode = fromDept.code;
    }
  }
  return user;
}

export function isResponse(x: SessionUser | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}

export async function json(data: unknown, status = 200) {
  await flushPgWrites();
  return NextResponse.json(data, { status });
}
