"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SimpleMapFallback } from "@/components/fleet/simple-map-fallback";
import {
  STATUS_LABEL,
} from "@/lib/vehicle-status";
import type { MapVehicle } from "@/lib/types/vehicle";

type VehicleMapProps = {
  vehicles: MapVehicle[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  centerOnSelected?: boolean;
};

type KakaoMaps = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => unknown;
    Map: new (
      container: HTMLElement,
      options: { center: unknown; level: number },
    ) => {
      setCenter: (center: unknown) => void;
      setLevel: (level: number) => void;
    };
    Marker: new (options: {
      map: unknown;
      position: unknown;
      title?: string;
    }) => {
      setMap: (map: unknown | null) => void;
    };
    InfoWindow: new (options: { content: string }) => {
      open: (map: unknown, marker: unknown) => void;
      close: () => void;
    };
    event: {
      addListener: (target: unknown, type: string, handler: () => void) => void;
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoMaps;
  }
}

let kakaoLoader: Promise<KakaoMaps> | null = null;

function loadKakaoMaps(appKey: string) {
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao);
  }

  if (!kakaoLoader) {
    kakaoLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      script.async = true;
      script.onload = () => {
        window.kakao?.maps.load(() => {
          if (window.kakao?.maps) {
            resolve(window.kakao);
          } else {
            reject(new Error("Kakao maps failed to load"));
          }
        });
      };
      script.onerror = () => reject(new Error("Kakao maps script failed"));
      document.head.appendChild(script);
    });
  }

  return kakaoLoader;
}

export function VehicleMap({
  vehicles,
  selectedId,
  onSelect,
  height = 420,
  centerOnSelected = false,
}: VehicleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<KakaoMaps["maps"]["Map"]> | null>(null);
  const markersRef = useRef<InstanceType<KakaoMaps["maps"]["Marker"]>[]>([]);
  const infoWindowRef = useRef<InstanceType<KakaoMaps["maps"]["InfoWindow"]> | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!apiKey || !containerRef.current || vehicles.length === 0) return;

    let cancelled = false;

    loadKakaoMaps(apiKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;

        const centerVehicle = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0];
        const center = new kakao.maps.LatLng(
          centerVehicle.latitude,
          centerVehicle.longitude,
        );

        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, {
            center,
            level: 7,
          });
          infoWindowRef.current = new kakao.maps.InfoWindow({ content: "" });
        } else if (centerOnSelected && selectedId) {
          mapRef.current.setCenter(center);
          mapRef.current.setLevel(5);
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        vehicles.forEach((vehicle) => {
          const position = new kakao.maps.LatLng(vehicle.latitude, vehicle.longitude);
          const marker = new kakao.maps.Marker({
            map: mapRef.current,
            position,
            title: vehicle.plateNumber,
          });

          kakao.maps.event.addListener(marker, "click", () => {
            onSelect?.(vehicle.id);
            infoWindowRef.current?.close();
            infoWindowRef.current = new kakao.maps.InfoWindow({
              content: `
                <div style="padding:8px 10px;min-width:160px;font-size:13px;line-height:1.5">
                  <strong>${vehicle.plateNumber}</strong><br/>
                  ${vehicle.model}<br/>
                  ${STATUS_LABEL[vehicle.status]} · 배터리 ${vehicle.batteryPercent != null ? `${Math.round(vehicle.batteryPercent)}%` : "-"}
                </div>
              `,
            });
            infoWindowRef.current.open(mapRef.current, marker);
          });

          markersRef.current.push(marker);
        });

        setReady(true);
      })
      .catch(() => {
        setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, centerOnSelected, onSelect, selectedId, vehicles]);

  if (!apiKey) {
    return (
      <SimpleMapFallback
        vehicles={vehicles}
        selectedId={selectedId}
        onSelect={onSelect}
        height={height}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border"
        style={{ height }}
      />
      {!ready ? (
        <p className="text-sm text-muted-foreground">지도를 불러오는 중...</p>
      ) : null}
      {selectedId ? (
        <SelectedVehicleLink vehicles={vehicles} selectedId={selectedId} />
      ) : null}
    </div>
  );
}

function SelectedVehicleLink({
  vehicles,
  selectedId,
}: {
  vehicles: MapVehicle[];
  selectedId: string;
}) {
  const vehicle = vehicles.find((item) => item.id === selectedId);
  if (!vehicle) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{vehicle.plateNumber}</p>
          <p className="text-sm text-muted-foreground">
            {vehicle.model} · {STATUS_LABEL[vehicle.status]}
          </p>
        </div>
        <Link href={`/vehicles/${vehicle.id}`} className="text-sm text-primary hover:underline">
          상세 보기
        </Link>
      </div>
    </div>
  );
}
