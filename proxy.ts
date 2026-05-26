import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  isAdminSessionValueValid,
} from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = await isAdminSessionValueValid(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );

  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminLoginApi = pathname === "/api/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage) {
    if (!isAuthenticated && !isAdminLoginPage) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (isAuthenticated && isAdminLoginPage) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (isAdminApi && !isAuthenticated && !isAdminLoginApi) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
