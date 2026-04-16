import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, normalizeNextPath, verifySessionToken } from "@/lib/auth";

const PUBLIC_FILE_PATTERN = /\.[^/]+$/;

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = normalizeNextPath(`${pathname}${search}`);
  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*"],
};
