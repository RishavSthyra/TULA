import type { Metadata } from "next";
import DeveloperDashboard from "@/components/developer/DeveloperDashboard";
import { SITE_NAME } from "@/lib/metadata";

export const metadata: Metadata = {
  title: `Developer Configuration | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function DeveloperPage() {
  return <DeveloperDashboard />;
}
