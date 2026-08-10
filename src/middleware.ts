import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/entrer", "/manifest.webmanifest", "/icone.svg"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const who = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!who && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrer";
    url.search = pathname === "/" ? "" : `?suite=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (who && pathname === "/entrer") {
    const url = request.nextUrl.clone();
    url.pathname = "/nous";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
