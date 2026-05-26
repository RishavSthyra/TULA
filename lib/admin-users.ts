import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { connectToDatabase } from "@/lib/mongodb";
import AdminUser, { type AdminUserDocument } from "@/models/AdminUser";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export type AdminUserSummary = {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

export function normalizeAdminUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateAdminUsername(username: string) {
  const normalizedUsername = normalizeAdminUsername(username);

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return {
      valid: false,
      message:
        "Username must be 3-40 characters and use only letters, numbers, dot, dash, or underscore.",
    };
  }

  return { valid: true, normalizedUsername };
}

export function validateAdminPassword(password: string) {
  if (password.trim().length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  return { valid: true };
}

export async function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;

  return {
    passwordSalt: salt,
    passwordHash: hash.toString("hex"),
  };
}

export async function verifyAdminPassword(
  password: string,
  passwordSalt: string,
  passwordHash: string,
) {
  const derivedHash = (await scrypt(
    password,
    passwordSalt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;
  const expectedHash = Buffer.from(passwordHash, "hex");

  if (expectedHash.length !== derivedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, derivedHash);
}

export function serializeAdminUser(
  user: Pick<
    AdminUserDocument & { _id: { toString(): string } },
    "_id" | "username" | "displayName" | "isActive" | "createdAt" | "lastLoginAt"
  >,
): AdminUserSummary {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || "",
    isActive: user.isActive,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : null,
    lastLoginAt:
      user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : null,
  };
}

export async function getAdminUserByUsername(username: string) {
  await connectToDatabase();
  return AdminUser.findOne({ username: normalizeAdminUsername(username) }).lean();
}

export async function getAdminUserById(id: string) {
  await connectToDatabase();
  return AdminUser.findById(id).lean();
}

export async function listAdminUsers() {
  await connectToDatabase();

  const users = await AdminUser.find({})
    .sort({ createdAt: -1 })
    .lean();

  return users.map((user) =>
    serializeAdminUser(
      user as AdminUserDocument & { _id: { toString(): string } },
    ),
  );
}

export async function createAdminUser(input: {
  username: string;
  password: string;
  displayName?: string;
  createdBy?: string | null;
}) {
  const usernameValidation = validateAdminUsername(input.username);
  if (!usernameValidation.valid) {
    throw new Error(usernameValidation.message);
  }

  const passwordValidation = validateAdminPassword(input.password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message);
  }

  await connectToDatabase();

  const existingUser = await AdminUser.findOne({
    username: usernameValidation.normalizedUsername,
  })
    .select("_id")
    .lean();

  if (existingUser) {
    throw new Error("An admin account with that username already exists.");
  }

  const { passwordHash, passwordSalt } = await hashAdminPassword(input.password);
  const createdUser = await AdminUser.create({
    username: usernameValidation.normalizedUsername,
    displayName: input.displayName?.trim() || "",
    passwordHash,
    passwordSalt,
    createdBy: input.createdBy || null,
  });

  return serializeAdminUser(
    createdUser.toObject() as AdminUserDocument & { _id: { toString(): string } },
  );
}
