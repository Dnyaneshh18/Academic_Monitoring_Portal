import { NextRequest, NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/cookie";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), "", { ...sessionCookieOptions(req), maxAge: 0 });
  return res;
}
