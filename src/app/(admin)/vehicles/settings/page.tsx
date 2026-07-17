import type { Metadata } from "next";
import { Suspense } from "react";

import { FleetVehiclesSettingsView } from "@/components/fms/FleetVehiclesSettingsView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("Vehicles Settings"),
  description: "보리차 차량 등록 · Telemetry 연동",
};

export default function VehiclesSettingsPage() {
  return (
    <Suspense fallback={<p className="text-theme-sm text-gray-500">로딩 중...</p>}>
      <FleetVehiclesSettingsView />
    </Suspense>
  );
}
