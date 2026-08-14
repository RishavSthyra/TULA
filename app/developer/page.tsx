import type { Metadata } from "next";
import DeveloperDashboard from "@/components/developer/DeveloperDashboard";

export const metadata: Metadata = {
  title: "Developer Configuration | Trifecta",
  robots: { index: false, follow: false },
};

export default function DeveloperPage() {
  return <DeveloperDashboard />;
}
