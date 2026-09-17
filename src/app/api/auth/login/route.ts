import { NextRequest, NextResponse } from "next/server";
import { authenticate, cookieName, signSession } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/cookie";
import { ensureDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureDb();
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "");
  const password = String(body.password || "");
  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const token = await signSession(user);
  const res = NextResponse.json({ user, token });
  res.cookies.set(cookieName(), token, sessionCookieOptions(req));
  return res;
}
