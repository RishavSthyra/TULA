import { NextResponse } from "next/server";
import {
  getAuthenticatedAdminUserId,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import {
  createAdminUser,
  listAdminUsers,
} from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const users = await listAdminUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to load admin users:", error);
    return NextResponse.json(
      { message: "Failed to load admin users." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
    };

    if (!body.username || !body.password) {
      return NextResponse.json(
        { message: "Username and password are required." },
        { status: 400 },
      );
    }

    const currentAdminUserId = await getAuthenticatedAdminUserId();
    const user = await createAdminUser({
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      createdBy: currentAdminUserId,
    });

    return NextResponse.json(
      { message: "Admin user created.", user },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Failed to create admin user:", error);
    return NextResponse.json(
      { message: "Failed to create admin user." },
      { status: 500 },
    );
  }
}
