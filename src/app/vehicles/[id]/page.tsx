import { VehicleDetailView } from "@/components/fleet/vehicle-detail-view";

type VehicleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  return <VehicleDetailView vehicleId={id} />;
}
