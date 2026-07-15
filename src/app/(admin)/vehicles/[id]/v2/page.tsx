import type { Metadata } from "next";

import { FleetVehicleDetailView } from "@/components/fms/FleetVehicleDetailView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("차량 상세 (이전)"),
  description: "보리차 이전 차량 상세 화면",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDetailV2Page({ params }: PageProps) {
  const { id } = await params;
  return <FleetVehicleDetailView vehicleId={id} />;
}
