import { NextResponse } from "next/server";
import { getAdminLogoutCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.set(getAdminLogoutCookie());
  return response;
}
