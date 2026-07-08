"use client";

import { VehicleMap } from "@/components/fleet/vehicle-map";
import type { MapVehicle } from "@/lib/types/vehicle";

type FleetMapCardProps = {
  vehicles: MapVehicle[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  mapHeight?: number;
  fillHeight?: boolean;
};

export function FleetMapCard({
  vehicles,
  selectedId,
  onSelect,
  className,
  mapHeight = 420,
  fillHeight = false,
}: FleetMapCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${
        fillHeight ? "flex h-full min-h-0 flex-col" : ""
      } ${className ?? ""}`}
    >
      <div className="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5 sm:py-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
          실시간 플릿 지도
        </h3>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400 sm:text-theme-sm">
          {vehicles.length}대 · 마커 색상으로 상태를 확인하세요
        </p>
      </div>
      <div className={fillHeight ? "h-full min-h-[300px] sm:min-h-[360px]" : undefined}>
        <VehicleMap
          vehicles={vehicles}
          selectedId={selectedId}
          onSelect={onSelect}
          height={mapHeight}
          hero
        />
      </div>
    </div>
  );
}
