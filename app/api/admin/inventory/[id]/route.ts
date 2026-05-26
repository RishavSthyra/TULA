import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { connectToDatabase } from "@/lib/mongodb";
import Inventory from "@/models/Inventory";
import { parseInventoryStatusInput } from "@/lib/inventory";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid inventory id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { status?: unknown };
    const status = parseInventoryStatusInput(body.status);

    if (!status) {
      return NextResponse.json(
        { message: "Invalid inventory status." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const updated = await Inventory.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { message: "Inventory item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Inventory status updated.",
      status,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    console.error(`Failed to update inventory status for ${id}:`, error);
    return NextResponse.json(
      { message: "Failed to update inventory status." },
      { status: 500 },
    );
  }
}
