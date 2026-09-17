import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createSubject, listSubjects } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const facultyId = user.role === "FACULTY" ? user.facultyId : undefined;
  return json(listSubjects({ facultyId, collegeId: collegeScope(user) }));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "STUDENT") return json({ error: "Forbidden" }, 403);
  const body = await req.json();
  createSubject(body);
  return json({ ok: true });
}
