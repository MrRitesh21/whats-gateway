import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets, MCP endpoints, and install APIs to pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/mcp") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/install") ||
    pathname.startsWith("/api/system") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If visiting /install, continue
  if (pathname === "/install") {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
