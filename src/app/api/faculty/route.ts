import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createUser, listFaculty } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json(listFaculty(collegeScope(user)));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN") return json({ error: "Forbidden" }, 403);
  const body = await req.json();
  createUser({
    email: body.email,
    password: body.password || "Faculty@123",
    name: body.name,
    role: body.role === "HOD" ? "HOD" : "FACULTY",
    phone: body.phone,
    extra: {
      employeeId: body.employeeId,
      designation: body.designation,
      departmentId: body.departmentId,
      collegeId: collegeScope(user) || ""
    }
  });
  return json({ ok: true });
}
