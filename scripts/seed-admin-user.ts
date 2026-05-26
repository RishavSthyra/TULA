import "dotenv/config";
import { connectToDatabase } from "@/lib/mongodb";
import {
  createAdminUser,
  hashAdminPassword,
  normalizeAdminUsername,
} from "@/lib/admin-users";
import AdminUser from "@/models/AdminUser";

async function run() {
  const shouldResetPassword =
    process.argv.includes("--reset-password") ||
    process.env.SEED_ADMIN_RESET_PASSWORD === "true";
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "sthyra-admin";
  const password = process.env.SEED_ADMIN_PASSWORD?.trim() || "veranza-admin-2026";
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME?.trim() || "Primary Admin";
  const normalizedUsername = normalizeAdminUsername(username);

  await connectToDatabase();

  const existingUser = await AdminUser.findOne({
    username: normalizedUsername,
  })
    .select("_id username")
    .lean();

  if (existingUser) {
    if (!shouldResetPassword) {
      console.log(`Admin user already exists: ${existingUser.username}`);
      console.log("Use --reset-password to overwrite the existing password.");
      return;
    }

    const { passwordHash, passwordSalt } = await hashAdminPassword(password);
    await AdminUser.findByIdAndUpdate(existingUser._id, {
      $set: {
        displayName,
        isActive: true,
        passwordHash,
        passwordSalt,
      },
    });

    console.log(`Reset password for admin user: ${existingUser.username}`);
    return;
  }

  const user = await createAdminUser({
    username,
    password,
    displayName,
  });

  console.log(`Created initial admin user: ${user.username}`);
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed admin user:", error);
    process.exit(1);
  });
