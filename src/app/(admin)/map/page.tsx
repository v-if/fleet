import type { Metadata } from "next";

import { FleetMapView } from "@/components/fms/FleetMapView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("플릿 지도"),
  description: "보리차 차량 위치 지도",
};

export default function MapPage() {
  return <FleetMapView />;
}
