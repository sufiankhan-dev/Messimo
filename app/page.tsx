import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: { absolute: "Messimo — Local AI File Organizer" },
};

export default function DashboardPage() {
  return <DashboardView />;
}
