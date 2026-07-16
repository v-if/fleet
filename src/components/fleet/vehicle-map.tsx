"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { SimpleMapFallback } from "@/components/fleet/simple-map-fallback";
import { hasValidCoordinates, STATUS_LABEL } from "@/lib/vehicle-status";
import {
  nearbySiteMarkerTitle,
  nearbySiteTypeColor,
} from "@/lib/vehicle-detail-v3";
import type { MapVehicle } from "@/lib/types/vehicle";

/** VD3-NM — 상세 맵 인근 충전소 핀 (좌표 있는 건만) */
export type MapNearbySite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  siteType?: "destination" | "supercharger" | null;
  /** VD3-NL — 목록과 동일 기호 (A–E) */
  label: string;
};

type VehicleMapProps = {
  vehicles: MapVehicle[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  centerOnSelected?: boolean;
  hero?: boolean;
  /** 상세 화면 등에서 번호·모델·「상세 보기」 선택 카드 숨김 */
  hideSelectionCard?: boolean;
  /** 상세 V3 — 인근 충전소 마커 (목록과 동일 상위 N건) */
  nearbySites?: MapNearbySite[];
};

type PositionedMapVehicle = MapVehicle & {
  status: NonNullable<MapVehicle["status"]>;
  latitude: number;
  longitude: number;
};

type NaverLatLng = unknown;
type NaverMap = {
  setCenter: (center: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (
    bounds: NaverLatLngBounds,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ) => void;
};
type NaverLatLngBounds = {
  extend: (latlng: NaverLatLng) => void;
};
type NaverMarker = {
  setMap: (map: NaverMap | null) => void;
  setPosition: (position: NaverLatLng) => void;
  setIcon: (icon: { content: HTMLElement; anchor?: unknown }) => void;
  setZIndex: (zIndex: number) => void;
};

type NaverMaps = {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    LatLngBounds: new (sw?: NaverLatLng, ne?: NaverLatLng) => NaverLatLngBounds;
    Point: new (x: number, y: number) => unknown;
    Map: new (
      container: string | HTMLElement,
      options: { center: NaverLatLng; zoom: number },
    ) => NaverMap;
    Marker: new (options: {
      map: NaverMap | null;
      position: NaverLatLng;
      icon?: { content: string | HTMLElement; anchor?: unknown };
      zIndex?: number;
      title?: string;
    }) => NaverMarker;
  };
};

declare global {
  interface Window {
    naver?: NaverMaps;
    navermap_authFailure?: () => void;
  }
}

const NAVER_LOAD_TIMEOUT_MS = 12_000;
const NAVER_READY_POLL_MS = 50;
const NAVER_READY_MAX_ATTEMPTS = 60;

let naverLoader: Promise<NaverMaps> | null = null;

function getReadyNaverMaps(): NaverMaps | null {
  const maps = window.naver?.maps;
  if (
    maps &&
    typeof maps.LatLng === "function" &&
    typeof maps.Map === "function" &&
    typeof maps.Marker === "function"
  ) {
    return window.naver as NaverMaps;
  }
  return null;
}

/** SDK callback은 naver.maps 할당보다 먼저 불릴 수 있어 폴링으로 대기 */
function waitForNaverMaps(timeoutMs: number) {
  return new Promise<NaverMaps>((resolve, reject) => {
    const ready = getReadyNaverMaps();
    if (ready) {
      resolve(ready);
      return;
    }

    let attempts = 0;
    const started = Date.now();
    const timer = window.setInterval(() => {
      attempts += 1;
      const sdk = getReadyNaverMaps();
      if (sdk) {
        window.clearInterval(timer);
        resolve(sdk);
        return;
      }
      if (attempts >= NAVER_READY_MAX_ATTEMPTS || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        reject(
          new Error(
            "Naver maps SDK not ready (Client ID / Web 서비스 URL을 확인하세요)",
          ),
        );
      }
    }, NAVER_READY_POLL_MS);
  });
}

/** NCP Web 서비스 URL 인증 사전 확인 (SDK와 동일하게 JSONP 사용) */
function assertNaverMapAuth(clientId: string) {
  return new Promise<void>((resolve, reject) => {
    const pageUrl = `${window.location.protocol}//${window.location.host}/`;
    const callbackName = `__naverAuthCheck_${Date.now()}`;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 5_000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (payload: {
      result?: unknown;
      error?: { message?: string; details?: string };
    }) => {
      cleanup();
      if (payload?.result) {
        resolve();
        return;
      }

      const details =
        payload?.error?.details || payload?.error?.message || "Authentication Failed";
      const hint =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
          ? "NCP Application → Web 서비스 URL에 http://localhost 를 추가하세요 (포트·path 제외)."
          : `NCP Application → Web 서비스 URL에 ${window.location.protocol}//${window.location.host} 를 등록하세요.`;

      reject(new Error(`Naver maps auth failed: ${details}. ${hint}`));
    };

    const script = document.createElement("script");
    script.src =
      `https://oapi.map.naver.com/v3/auth?ncpKeyId=${encodeURIComponent(clientId)}` +
      `&url=${encodeURIComponent(pageUrl)}&time=${Date.now()}` +
      `&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      resolve();
    };
    document.head.appendChild(script);
  });
}

function resetBrokenNaverNamespace() {
  // 이전 인증 실패 시 SDK가 naver.maps=null 로 남겨 재로드를 막음
  if (window.naver && !getReadyNaverMaps()) {
    try {
      delete (window as { naver?: NaverMaps }).naver;
    } catch {
      (window as { naver?: NaverMaps | null }).naver = undefined;
    }
  }
}

function loadNaverMaps(clientId: string) {
  const ready = getReadyNaverMaps();
  if (ready) {
    return Promise.resolve(ready);
  }

  if (!naverLoader) {
    naverLoader = (async () => {
      await assertNaverMapAuth(clientId);
      resetBrokenNaverNamespace();

      await new Promise<void>((resolve, reject) => {
        const callbackName = `__naverMapsInit_${Date.now()}`;
        let settled = false;

        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          delete (window as unknown as Record<string, unknown>)[callbackName];
          window.navermap_authFailure = previousAuthFailure;
          if (error) reject(error);
          else resolve();
        };

        const timeoutId = window.setTimeout(() => {
          done(new Error("Naver maps load timed out"));
        }, NAVER_LOAD_TIMEOUT_MS);

        const previousAuthFailure = window.navermap_authFailure;
        window.navermap_authFailure = () => {
          previousAuthFailure?.();
          done(
            new Error(
              "Naver maps auth failed (Client ID 또는 Web 서비스 URL을 확인하세요)",
            ),
          );
        };

        // callback은 maps 할당 전에 호출되므로, 여기서는 스크립트 도착만 알리고
        // 실제 ready는 아래에서 폴링한다.
        (window as unknown as Record<string, unknown>)[callbackName] = () => {
          done();
        };

        const script = document.createElement("script");
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&callback=${callbackName}`;
        script.async = true;
        script.onerror = () => {
          done(new Error("Naver maps script failed"));
        };
        document.head.appendChild(script);
      });

      return waitForNaverMaps(NAVER_LOAD_TIMEOUT_MS);
    })();
  }

  return naverLoader.catch((error) => {
    naverLoader = null;
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

function markerAnchor(naver: NaverMaps, selected: boolean) {
  // pin roughly centered horizontally, anchored at bottom of badge stack
  const x = selected ? 20 : 16;
  const y = selected ? 58 : 50;
  return new naver.maps.Point(x, y);
}

function nearbyMarkerHtml(site: MapNearbySite) {
  const bg = nearbySiteTypeColor(site.siteType);
  const label = site.label;
  const title = nearbySiteMarkerTitle(label, site.name, site.distanceKm);
  const distance =
    site.distanceKm != null ? `${site.distanceKm.toLocaleString("ko-KR")} km` : "";

  return `
    <div title="${escapeHtmlAttr(title)}" style="
      display:flex;flex-direction:column;align-items:center;pointer-events:none;
    ">
      <div style="
        width:28px;height:28px;border-radius:8px;border:2px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,0.28);background:${bg};
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:11px;font-weight:800;letter-spacing:-0.02em;
      ">${escapeHtmlAttr(label)}</div>
      ${
        distance
          ? `<div style="
        margin-top:3px;padding:1px 6px;border-radius:9999px;background:rgba(24,24,27,0.82);
        color:white;font-size:9px;font-weight:600;white-space:nowrap;
      ">${distance}</div>`
          : ""
      }
    </div>
  `;
}

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nearbyMarkerAnchor(naver: NaverMaps) {
  return new naver.maps.Point(14, 42);
}

export function VehicleMap({
  vehicles,
  selectedId,
  onSelect,
  height = 420,
  centerOnSelected = false,
  hero = false,
  hideSelectionCard = false,
  nearbySites = [],
}: VehicleMapProps) {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim();
  const validVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle): vehicle is PositionedMapVehicle =>
          vehicle.status != null && hasValidCoordinates(vehicle.latitude, vehicle.longitude),
      ),
    [vehicles],
  );
  const validNearbySites = useMemo(
    () =>
      nearbySites.filter((site) =>
        hasValidCoordinates(site.latitude, site.longitude),
      ),
    [nearbySites],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const onSelectRef = useRef(onSelect);
  const vehiclesRef = useRef<PositionedMapVehicle[]>([]);
  const nearbyRef = useRef<MapNearbySite[]>([]);
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<"no_key" | "load_failed" | "no_coords">(
    "no_key",
  );

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

  const nearbySignature = useMemo(
    () =>
      validNearbySites
        .map(
          (site) =>
            `${site.id}:${site.latitude}:${site.longitude}:${site.siteType ?? ""}:${site.distanceKm ?? ""}:${site.label}`,
        )
        .join("|"),
    [validNearbySites],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
    vehiclesRef.current = validVehicles;
    nearbyRef.current = validNearbySites;
  }, [onSelect, validVehicles, validNearbySites]);

  useEffect(() => {
    if (!clientId || vehiclesRef.current.length === 0) {
      return;
    }

    const currentVehicles = vehiclesRef.current;
    const currentNearby = nearbyRef.current;
    let cancelled = false;

    loadNaverMaps(clientId)
      .then((naver) => {
        if (cancelled || !containerRef.current) return;
        if (typeof naver.maps?.LatLng !== "function") {
          throw new Error("Naver maps.LatLng is not ready");
        }

        const centerVehicle =
          currentVehicles.find((vehicle) => vehicle.id === selectedId) ??
          currentVehicles[0];
        const center = new naver.maps.LatLng(
          centerVehicle.latitude,
          centerVehicle.longitude,
        );

        if (!mapRef.current) {
          mapRef.current = new naver.maps.Map(containerRef.current, {
            center,
            zoom: hero ? 12 : 13,
          });
        } else if (centerOnSelected && selectedId && currentNearby.length === 0) {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(hero ? 14 : 15);
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        currentVehicles.forEach((vehicle) => {
          const position = new naver.maps.LatLng(vehicle.latitude, vehicle.longitude);
          const selected = vehicle.id === selectedId;
          const content = document.createElement("div");
          content.innerHTML = markerHtml(vehicle, selected);
          const button = content.querySelector("button");
          button?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectRef.current?.(vehicle.id);
          });

          const marker = new naver.maps.Marker({
            map: mapRef.current,
            position,
            icon: {
              content,
              anchor: markerAnchor(naver, selected),
            },
            zIndex: selected ? 10 : 1,
          });

          markersRef.current.push(marker);
        });

        currentNearby.forEach((site) => {
          const position = new naver.maps.LatLng(site.latitude, site.longitude);
          const content = document.createElement("div");
          content.innerHTML = nearbyMarkerHtml(site);

          const marker = new naver.maps.Marker({
            map: mapRef.current,
            position,
            icon: {
              content,
              anchor: nearbyMarkerAnchor(naver),
            },
            title: nearbySiteMarkerTitle(site.label, site.name, site.distanceKm),
            zIndex: 5,
          });

          markersRef.current.push(marker);
        });

        if (
          mapRef.current &&
          currentNearby.length > 0 &&
          typeof naver.maps.LatLngBounds === "function"
        ) {
          const bounds = new naver.maps.LatLngBounds();
          currentVehicles.forEach((vehicle) => {
            bounds.extend(new naver.maps.LatLng(vehicle.latitude, vehicle.longitude));
          });
          currentNearby.forEach((site) => {
            bounds.extend(new naver.maps.LatLng(site.latitude, site.longitude));
          });
          mapRef.current.fitBounds(bounds, {
            top: 40,
            right: 40,
            bottom: 40,
            left: 40,
          });
        }

        setUseFallback(false);
        setReady(true);
      })
      .catch((error) => {
        console.warn("Naver map unavailable, using fallback:", error);
        if (!cancelled) {
          setFallbackReason("load_failed");
          setUseFallback(true);
          setReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, centerOnSelected, hero, selectedId, vehicleSignature, nearbySignature]);

  if (!clientId || useFallback || validVehicles.length === 0) {
    const reason = !clientId
      ? "no_key"
      : validVehicles.length === 0
        ? "no_coords"
        : fallbackReason;

    return (
      <div className="space-y-3">
        <SimpleMapFallback
          vehicles={vehicles}
          selectedId={selectedId}
          onSelect={onSelect}
          height={height}
          hero={hero}
          reason={reason}
          hideSelectionCard={hideSelectionCard}
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
      {selectedId && !hideSelectionCard ? (
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
