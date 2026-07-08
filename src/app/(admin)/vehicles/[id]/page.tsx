import type { Metadata } from "next";

import { FleetVehicleDetailView } from "@/components/fms/FleetVehicleDetailView";

export const metadata: Metadata = {
  title: "차량 상세 | Fleet FMS",
  description: "차량 상세 정보",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <FleetVehicleDetailView vehicleId={id} />;
}
