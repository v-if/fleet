import type { Metadata } from "next";

import { FleetMapView } from "@/components/fms/FleetMapView";

export const metadata: Metadata = {
  title: "플릿 지도 | Fleet FMS",
  description: "차량 위치 지도",
};

export default function MapPage() {
  return <FleetMapView />;
}
