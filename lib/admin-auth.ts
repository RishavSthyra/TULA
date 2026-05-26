import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "sthyra_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const ADMIN_SESSION_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEV_ADMIN_SESSION_SECRET =
  process.env.NODE_ENV === "production"
    ? ""
    : `dev-admin-session-${crypto.randomUUID()}`;
const ADMIN_SESSION_SECRET_ENV_KEYS = [
  "ADMIN_SESSION_SECRET",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
] as const;
const encoder = new TextEncoder();

function resolveConfiguredAdminSessionSecret() {
  for (const envKey of ADMIN_SESSION_SECRET_ENV_KEYS) {
    const value = process.env[envKey]?.trim();

    if (value) {
      return {
        envKey,
        value,
      };
    }
  }

  return null;
}

function getAdminAuthConfig() {
  const configuredSecret = resolveConfiguredAdminSessionSecret();
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret =
    configuredSecret?.value ||
    (!isProduction ? DEV_ADMIN_SESSION_SECRET : "");

  return {
    configuredEnvKey: configuredSecret?.envKey ?? null,
    sessionSecret,
    isConfigured: Boolean(sessionSecret),
  };
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signSessionPayload(payload: string, sessionSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return toHex(signature);
}

export function isAdminAuthConfigured() {
  return getAdminAuthConfig().isConfigured;
}

export function getAdminAuthConfigurationError() {
  const config = getAdminAuthConfig();

  if (config.isConfigured) {
    return null;
  }

  return `Missing session secret. Configure one of: ${ADMIN_SESSION_SECRET_ENV_KEYS.join(", ")}.`;
}

export async function createAdminSessionValue(userId: string) {
  const config = getAdminAuthConfig();

  if (!config.isConfigured) {
    throw new Error("Admin auth is not configured.");
  }

  const expiresAt = String(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
  const payload = `${userId}.${expiresAt}`;
  const signature = await signSessionPayload(payload, config.sessionSecret);

  return `${payload}.${signature}`;
}

export async function isAdminSessionValueValid(value?: string | null) {
  return (await getAdminSessionPayload(value)) !== null;
}

export async function getAdminSessionPayload(value?: string | null) {
  const config = getAdminAuthConfig();

  if (!config.isConfigured || !value) {
    return null;
  }

  const [userId = "", expiresAtRaw = "", signature = ""] = value.split(".", 3);
  if (!userId || !expiresAtRaw || !/^\d+$/.test(expiresAtRaw) || !signature) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (
    !Number.isFinite(expiresAt) ||
    Date.now() - ADMIN_SESSION_CLOCK_SKEW_MS >= expiresAt
  ) {
    return null;
  }

  const payload = `${userId}.${expiresAtRaw}`;
  const expectedSignature = await signSessionPayload(payload, config.sessionSecret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  return {
    userId,
    expiresAt,
  };
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isAdminSessionValueValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function getAuthenticatedAdminUserId() {
  const cookieStore = await cookies();
  const session = await getAdminSessionPayload(
    cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  );

  return session?.userId ?? null;
}

export async function getAdminSessionCookie(userId: string) {
  return {
    name: ADMIN_COOKIE_NAME,
    value: await createAdminSessionValue(userId),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function getAdminLogoutCookie() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
