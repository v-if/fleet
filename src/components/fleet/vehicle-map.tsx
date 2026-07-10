"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { SimpleMapFallback } from "@/components/fleet/simple-map-fallback";
import { hasValidCoordinates, STATUS_LABEL } from "@/lib/vehicle-status";
import type { MapVehicle } from "@/lib/types/vehicle";

type VehicleMapProps = {
  vehicles: MapVehicle[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  centerOnSelected?: boolean;
  hero?: boolean;
};

type PositionedMapVehicle = MapVehicle & {
  status: NonNullable<MapVehicle["status"]>;
  latitude: number;
  longitude: number;
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
    CustomOverlay: new (options: {
      map: unknown;
      position: unknown;
      content: string | HTMLElement;
      yAnchor?: number;
      zIndex?: number;
    }) => {
      setMap: (map: unknown | null) => void;
      setPosition: (position: unknown) => void;
      setContent: (content: string | HTMLElement) => void;
      setZIndex: (zIndex: number) => void;
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

const KAKAO_LOAD_TIMEOUT_MS = 10_000;

let kakaoLoader: Promise<KakaoMaps> | null = null;

function loadKakaoMaps(appKey: string) {
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao);
  }

  if (!kakaoLoader) {
    kakaoLoader = new Promise<KakaoMaps>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Kakao maps load timed out"));
      }, KAKAO_LOAD_TIMEOUT_MS);

      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (!window.kakao?.maps) {
          window.clearTimeout(timeoutId);
          reject(new Error("Kakao maps SDK unavailable (check API key and domain)"));
          return;
        }

        window.kakao.maps.load(() => {
          window.clearTimeout(timeoutId);
          if (window.kakao?.maps) {
            resolve(window.kakao);
          } else {
            reject(new Error("Kakao maps failed to initialize"));
          }
        });
      };
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Kakao maps script failed"));
      };
      document.head.appendChild(script);
    });
  }

  return kakaoLoader.catch((error) => {
    kakaoLoader = null;
    throw error;
  });
}

function markerHtml(vehicle: PositionedMapVehicle, selected: boolean) {
  const shortPlate = vehicle.plateNumber.replace(/\s/g, "").slice(-4);
  const battery =
    vehicle.batteryPercent != null ? `${Math.round(vehicle.batteryPercent)}%` : "-";
  const ringColors: Record<NonNullable<MapVehicle["status"]>, string> = {
    ONLINE: "#10b981",
    OFFLINE: "#a1a1aa",
    ASLEEP: "#38bdf8",
    WARNING: "#f59e0b",
    ALERT: "#ef4444",
  };

  return `
    <button type="button" data-vehicle-id="${vehicle.id}" style="
      display:flex;flex-direction:column;align-items:center;border:none;background:transparent;cursor:pointer;
      transform:${selected ? "scale(1.1)" : "scale(1)"};transition:transform 0.2s;
    ">
      <div style="
        width:${selected ? "40px" : "32px"};height:${selected ? "40px" : "32px"};
        border-radius:9999px;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25);
        background:${ringColors[vehicle.status]};display:flex;align-items:center;justify-content:center;
        color:white;font-size:10px;font-weight:700;
      ">${shortPlate}</div>
      <div style="
        margin-top:4px;padding:2px 8px;border-radius:9999px;background:${selected ? "#e11d48" : "rgba(24,24,27,0.85)"};
        color:white;font-size:10px;font-weight:600;
      ">${battery}</div>
    </button>
  `;
}

export function VehicleMap({
  vehicles,
  selectedId,
  onSelect,
  height = 420,
  centerOnSelected = false,
  hero = false,
}: VehicleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim();
  const validVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle): vehicle is PositionedMapVehicle =>
          vehicle.status != null && hasValidCoordinates(vehicle.latitude, vehicle.longitude),
      ),
    [vehicles],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<KakaoMaps["maps"]["Map"]> | null>(null);
  const overlaysRef = useRef<InstanceType<KakaoMaps["maps"]["CustomOverlay"]>[]>([]);
  const onSelectRef = useRef(onSelect);
  const vehiclesRef = useRef<PositionedMapVehicle[]>([]);
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const vehicleSignature = useMemo(
    () =>
      validVehicles
        .map(
          (vehicle) =>
            `${vehicle.id}:${vehicle.latitude}:${vehicle.longitude}:${vehicle.status}:${vehicle.batteryPercent ?? ""}`,
        )
        .join("|"),
    [validVehicles],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
    vehiclesRef.current = validVehicles;
  }, [onSelect, validVehicles]);

  useEffect(() => {
    if (!apiKey || vehiclesRef.current.length === 0) {
      return;
    }

    const currentVehicles = vehiclesRef.current;
    let cancelled = false;

    loadKakaoMaps(apiKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;

        const centerVehicle =
          currentVehicles.find((vehicle) => vehicle.id === selectedId) ??
          currentVehicles[0];
        const center = new kakao.maps.LatLng(
          centerVehicle.latitude,
          centerVehicle.longitude,
        );

        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, {
            center,
            level: hero ? 8 : 7,
          });
        } else if (centerOnSelected && selectedId) {
          mapRef.current.setCenter(center);
          mapRef.current.setLevel(hero ? 6 : 5);
        }

        overlaysRef.current.forEach((overlay) => overlay.setMap(null));
        overlaysRef.current = [];

        currentVehicles.forEach((vehicle) => {
          const position = new kakao.maps.LatLng(vehicle.latitude, vehicle.longitude);
          const selected = vehicle.id === selectedId;
          const content = document.createElement("div");
          content.innerHTML = markerHtml(vehicle, selected);
          const button = content.querySelector("button");
          button?.addEventListener("click", (event) => {
            event.preventDefault();
            onSelectRef.current?.(vehicle.id);
          });

          const overlay = new kakao.maps.CustomOverlay({
            map: mapRef.current,
            position,
            content,
            yAnchor: 1,
            zIndex: selected ? 10 : 1,
          });

          overlaysRef.current.push(overlay);
        });

        setUseFallback(false);
        setReady(true);
      })
      .catch((error) => {
        console.warn("Kakao map unavailable, using fallback:", error);
        if (!cancelled) {
          setUseFallback(true);
          setReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, centerOnSelected, hero, selectedId, vehicleSignature]);

  if (!apiKey || useFallback || validVehicles.length === 0) {
    return (
      <div className="space-y-3">
        <SimpleMapFallback
          vehicles={vehicles}
          selectedId={selectedId}
          onSelect={onSelect}
          height={height}
          hero={hero}
        />
        {vehicles.length > 0 && validVehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tesla 차량의 위치 좌표가 없어 실제 지도를 표시하지 못했습니다.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border shadow-sm"
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
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{vehicle.plateNumber}</p>
          <p className="text-sm text-muted-foreground">
            {vehicle.model} · {vehicle.status ? STATUS_LABEL[vehicle.status] : "상태 정보 없음"}
          </p>
        </div>
        <Link href={`/fleet/vehicles/${vehicle.id}`} className="text-sm text-primary hover:underline">
          상세 보기
        </Link>
      </div>
    </div>
  );
}
