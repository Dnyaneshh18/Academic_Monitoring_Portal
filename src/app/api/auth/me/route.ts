import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json({ user });
}
