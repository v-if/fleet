import type { Metadata } from "next";

import { FleetDashboardView } from "@/components/fms/FleetDashboardView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("대시보드"),
  description: "보리차 차량 관제 대시보드",
};

export default function FleetDashboardPage() {
  return <FleetDashboardView />;
}
