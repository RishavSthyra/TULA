import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import DevtoolsGuard from "@/components/DevtoolsGuard";
import RouteChrome from "@/components/RouteChrome";
import TrifectaRemoteControlBridge from "@/components/TrifectaRemoteControlBridge";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/metadata";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: "/VeranzaFavicon.svg",
    shortcut: "/VeranzaFavicon.svg",
    apple: "/VeranzaFavicon.svg",
  },
  openGraph: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "font-sans", geist.variable)}>
      <body className="custom-scrollbar app-shell w-full bg-zinc-50 text-zinc-900 antialiased dark:bg-black dark:text-white">
        <div className="relative app-shell w-full overflow-x-hidden">
          <DevtoolsGuard />
          <TrifectaRemoteControlBridge />
          <RouteChrome />

          <main className="app-shell w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
