import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createDepartment, listDepartments } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json(listDepartments(collegeScope(user)));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "COLLEGE_ADMIN" && user.role !== "ADMIN" && user.role !== "HOD") {
    return json({ error: "Forbidden" }, 403);
  }
  const collegeId = collegeScope(user) || user.collegeId;
  if (!collegeId) return json({ error: "College admin only — pick a college first" }, 400);
  const body = await req.json();
  try {
    const id = createDepartment({ code: body.code, name: body.name, collegeId });
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 400);
  }
}
