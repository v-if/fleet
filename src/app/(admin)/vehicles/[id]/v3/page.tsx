import type { Metadata } from "next";

import { FleetVehicleDetailViewV3 } from "@/components/fms/FleetVehicleDetailViewV3";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("차량 상세 VD3"),
  description: "보리차 차량 상세 VD3 미리보기",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDetailV3Page({ params }: PageProps) {
  const { id } = await params;
  return <FleetVehicleDetailViewV3 vehicleId={id} />;
}
