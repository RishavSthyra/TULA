import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Admin Login",
  description:
    "Secure sign-in for the Trifecta Veranza inventory administration area.",
  robots: {
    index: false,
    follow: false,
  },
});

export default function AdminLoginPage() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(232,239,248,0.9)_35%,rgba(214,223,236,0.96))] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,460px)]">
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-zinc-500">
              Company Access
            </p>
            <h1 className="mt-4 max-w-xl font-[var(--font-sora)] text-5xl font-semibold tracking-[-0.05em] text-zinc-950">
              Protected inventory control for both towers.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">
              Sign in to update apartment visibility in real time. The dashboard
              is limited to status changes only, so the live master plan stays
              clean, fast, and consistent.
            </p>
          </div>

          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
