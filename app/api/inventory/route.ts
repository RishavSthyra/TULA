import { NextResponse } from "next/server";
import { getInventoryApartments } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apartments = await getInventoryApartments();
    return NextResponse.json({ apartments });
  } catch (error) {
    console.error("Failed to load inventory:", error);
    return NextResponse.json(
      { message: "Failed to load inventory." },
      { status: 500 },
    );
  }
}
