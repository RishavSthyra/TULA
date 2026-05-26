import { NextResponse } from "next/server";
import {
  getAdminAuthConfigurationError,
  getAdminSessionCookie,
  isAdminAuthConfigured,
} from "@/lib/admin-auth";
import {
  getAdminUserByUsername,
  verifyAdminPassword,
} from "@/lib/admin-users";
import AdminUser from "@/models/AdminUser";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    const authConfigurationError = getAdminAuthConfigurationError();

    if (authConfigurationError) {
      console.error("Admin login unavailable:", authConfigurationError);
    }

    return NextResponse.json(
      {
        message:
          authConfigurationError || "Admin login is currently unavailable.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!body.username || !body.password) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 },
      );
    }

    const adminUser = await getAdminUserByUsername(body.username);
    if (!adminUser || !adminUser.isActive) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 },
      );
    }

    const isValidPassword = await verifyAdminPassword(
      body.password,
      adminUser.passwordSalt,
      adminUser.passwordHash,
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 },
      );
    }

    await connectToDatabase();
    await AdminUser.findByIdAndUpdate(adminUser._id, {
      $set: { lastLoginAt: new Date() },
    });

    const response = NextResponse.json({ message: "Login successful." });
    response.cookies.set(
      await getAdminSessionCookie(adminUser._id.toString()),
    );
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid login payload." },
        { status: 400 },
      );
    }

    console.error("Admin login failed:", error);
    return NextResponse.json(
      { message: "Unable to login." },
      { status: 500 },
    );
  }
}
