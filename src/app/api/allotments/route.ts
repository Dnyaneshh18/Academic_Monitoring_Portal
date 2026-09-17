import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createAllotment, deleteAllotment, listAllotments, studentsForAllotment } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const user = await requireUser();
    if (isResponse(user)) return user;
    const allotmentId = req.nextUrl.searchParams.get("id");
    if (allotmentId) {
      const data = studentsForAllotment(allotmentId);
      if (
        user.role !== "ADMIN" &&
        user.role !== "COLLEGE_ADMIN" &&
        user.role !== "HOD" &&
        data.allotment?.faculty_id !== user.facultyId
      ) {
        return json({ error: "Forbidden" }, 403);
      }
      return json(data);
    }
    const collegeId = collegeScope(user);
    const wantAll = req.nextUrl.searchParams.get("all") === "1";
    if (wantAll && (user.role === "ADMIN" || user.role === "COLLEGE_ADMIN" || user.role === "HOD")) {
      return json(listAllotments(undefined, collegeId));
    }
    if (user.role === "ADMIN" || user.role === "COLLEGE_ADMIN") return json(listAllotments(undefined, collegeId));
    return json(listAllotments(user.facultyId));
  } catch (e) {
    console.error("[allotments GET]", e);
    return json([]);
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "HOD") {
    return json({ error: "Forbidden" }, 403);
  }
  const body = await req.json();
  try {
    const id = createAllotment({
      facultyId: body.facultyId,
      classId: body.classId,
      kind: body.kind === "LAB" ? "LAB" : "THEORY",
      batch: body.batch,
      subjectId: body.subjectId
    });
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not assign" }, 400);
  }
}

export async function DELETE(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "HOD") {
    return json({ error: "Forbidden" }, 403);
  }
  const id = req.nextUrl.searchParams.get("id") || (await req.json().catch(() => ({}))).id;
  if (!id) return json({ error: "id required" }, 400);
  deleteAllotment(id);
  return json({ ok: true });
}
