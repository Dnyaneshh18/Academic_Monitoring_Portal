import type { NextRequest } from "next/server";

export function sessionCookieOptions(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "";
  const https = proto === "https" || host.includes("e2b.app") || host.includes("arena");
  return {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: https ? ("none" as const) : ("lax" as const),
    secure: https
  };
}
