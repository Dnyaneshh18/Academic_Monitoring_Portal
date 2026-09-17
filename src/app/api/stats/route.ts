import { ensureDb } from "@/lib/db";
import { dashboardStats } from "@/lib/queries";
import { isResponse, requireUser, json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDb();
    const user = await requireUser();
    if (isResponse(user)) return user;
    return json(dashboardStats(user));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Stats failed" }, 500);
  }
}
