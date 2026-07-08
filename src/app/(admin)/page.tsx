import type { Metadata } from "next";

import { FleetDashboardView } from "@/components/fms/FleetDashboardView";

export const metadata: Metadata = {
  title: "Fleet Dashboard | Fleet FMS",
  description: "차량 관제 대시보드",
};

export default function FleetDashboardPage() {
  return <FleetDashboardView />;
}
