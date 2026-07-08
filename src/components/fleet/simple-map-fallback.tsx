"use client";

import Link from "next/link";
import { useMemo } from "react";

import { VehicleMarkerPin } from "@/components/fleet/vehicle-marker-pin";
import { hasValidCoordinates, STATUS_LABEL } from "@/lib/vehicle-status";
import type { MapVehicle } from "@/lib/types/vehicle";

type SimpleMapFallbackProps = {
  vehicles: MapVehicle[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  hero?: boolean;
};

const BOUNDS = {
  minLat: 37.35,
  maxLat: 37.58,
  minLng: 126.7,
  maxLng: 127.13,
};

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x, y };
}

export function SimpleMapFallback({
  vehicles,
  selectedId,
  onSelect,
  height = 420,
  hero = false,
}: SimpleMapFallbackProps) {
  const markers = useMemo(
    () =>
      vehicles.filter((vehicle) => hasValidCoordinates(vehicle.latitude, vehicle.longitude)),
    [vehicles],
  );

  return (
    <div className="space-y-3">
      <div
        className={`relative overflow-hidden rounded-xl border shadow-inner ${
          hero
            ? "bg-[radial-gradient(ellipse_at_center,#1e293b_0%,#0f172a_100%)]"
            : "bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)]"
        }`}
        style={{ height }}
      >
        <div
          className={`absolute inset-0 ${hero ? "opacity-20" : "opacity-30"}`}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`grid-x-${index}`}
              className={`absolute top-0 bottom-0 border-l ${
                hero ? "border-white/10" : "border-slate-300"
              }`}
              style={{ left: `${(index + 1) * 12.5}%` }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`grid-y-${index}`}
              className={`absolute right-0 left-0 border-t ${
                hero ? "border-white/10" : "border-slate-300"
              }`}
              style={{ top: `${(index + 1) * 16.66}%` }}
            />
          ))}
        </div>
        {markers.map((vehicle) => {
          const point = project(vehicle.latitude, vehicle.longitude);
          const selected = selectedId === vehicle.id;

          return (
            <button
              key={vehicle.id}
              type="button"
              title={vehicle.plateNumber}
              onClick={() => onSelect?.(vehicle.id)}
              className="absolute z-10 -translate-x-1/2 -translate-y-full transition-transform duration-200"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              <VehicleMarkerPin
                plateNumber={vehicle.plateNumber}
                status={vehicle.status}
                batteryPercent={vehicle.batteryPercent}
                selected={selected}
              />
            </button>
          );
        })}
      </div>
      {!hero ? (
        <p className="text-sm text-muted-foreground">
          Kakao Maps API 키가 없어 간이 지도로 표시 중입니다.{" "}
          <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_KAKAO_MAP_KEY</code>를
          설정하면 실제 지도로 전환됩니다.
        </p>
      ) : null}
      {vehicles.length > 0 && markers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          현재 차량에서 유효한 위치 좌표를 받지 못해 지도를 표시할 수 없습니다.
        </p>
      ) : null}
      {selectedId ? (
        <SelectedVehicleSummary vehicles={vehicles} selectedId={selectedId} />
      ) : null}
    </div>
  );
}

function SelectedVehicleSummary({
  vehicles,
  selectedId,
}: {
  vehicles: MapVehicle[];
  selectedId: string;
}) {
  const vehicle = vehicles.find((item) => item.id === selectedId);
  if (!vehicle) return null;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{vehicle.plateNumber}</p>
          <p className="text-sm text-muted-foreground">
            {vehicle.model} · {STATUS_LABEL[vehicle.status]}
            {vehicle.batteryPercent != null
              ? ` · ${Math.round(vehicle.batteryPercent)}%`
              : ""}
          </p>
        </div>
        <Link href={`/fleet/vehicles/${vehicle.id}`} className="text-sm text-primary hover:underline">
          상세 보기
        </Link>
      </div>
    </div>
  );
}
