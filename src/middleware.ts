import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const header = req.headers.get("authorization");
  const custom = req.headers.get("x-amp-token");
  const query = req.nextUrl.searchParams.get("access_token");
  const cookie = req.cookies.get("amp_token")?.value;
  const token =
    (header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "") || custom || query || cookie || "";
  if (!token) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set("authorization", `Bearer ${token}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"]
};
