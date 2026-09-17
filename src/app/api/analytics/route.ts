import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { branchAnalytics, collegeScope } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  const branch = req.nextUrl.searchParams.get("branch") || "";
  return json(branchAnalytics(branch || undefined, collegeScope(user)));
}
