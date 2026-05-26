import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getInventoryAdminRows } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const inventory = await getInventoryAdminRows();
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Failed to load admin inventory:", error);
    return NextResponse.json(
      { message: "Failed to load admin inventory." },
      { status: 500 },
    );
  }
}
