"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, User2 } from "lucide-react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDevelopment = process.env.NODE_ENV !== "production";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(result.message || "Unable to login.");
      return;
    }

    startTransition(() => {
      router.push("/admin");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-[28px] border border-white/50 bg-white/72 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
        Protected Access
      </p>
      <h1 className="mt-3 font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
        Admin Login
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Sign in to manage flat visibility across both towers.
      </p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            <User2 className="h-3.5 w-3.5" />
            Username
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            placeholder="Enter username"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            <LockKeyhole className="h-3.5 w-3.5" />
            Password
          </span>
          <div className="relative">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 pr-12 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-zinc-500 transition hover:text-zinc-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </label>
      </div>

      {isDevelopment ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Default dev login: <span className="font-semibold">sthyra-admin</span> /{" "}
          <span className="font-semibold">veranza-admin-2026</span>.
          If you forgot the password, run <span className="font-mono">npx tsx scripts/seed-admin-user.ts --reset-password</span>.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Enter Dashboard"}
      </button>
    </form>
  );
}
