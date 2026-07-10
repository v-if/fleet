import type { Metadata } from "next";
import { Suspense } from "react";

import { FleetVehiclesListView } from "@/components/fms/FleetVehiclesListView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("차량 목록"),
  description: "보리차 플릿 차량 목록",
};

export default function VehiclesPage() {
  return (
    <Suspense fallback={<p className="text-theme-sm text-gray-500">로딩 중...</p>}>
      <FleetVehiclesListView />
    </Suspense>
  );
}
