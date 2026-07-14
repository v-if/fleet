"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BatteryHealthGauge } from "@/components/fleet/battery-health-gauge";
import { TpmsDiagram } from "@/components/fleet/tpms-diagram";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import { BatteryProgressBar } from "@/components/fms/BatteryProgressBar";
import {
  ChargingSessionCard,
  shouldShowChargingSessionCard,
} from "@/components/fms/ChargingSessionCard";
import { TelemetryValueMonitorCard } from "@/components/fms/TelemetryValueMonitorCard";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useRouter } from "next/navigation";
import { useVehicleDetail, useVehicleRefresh } from "@/hooks/use-vehicles";
import {
  vehicleStatusBadgeColor,
} from "@/lib/fms-badge-utils";
import { labelCarType, labelTrimBadging } from "@/lib/tesla/display-model";
import type { MapVehicle, VehicleDetailDto } from "@/lib/types/vehicle";
import {
  DISCONNECT_REASON_LABEL,
  LIFECYCLE_LABEL,
  REST_SYNC_REASON_LABEL,
  formatColorBadge,
  lifecycleBadgeColor,
  lifecycleGuidance,
} from "@/lib/vehicle-lifecycle";
import {
  SERVICE_STATUS_LABEL,
  STATUS_LABEL,
  formatDateTime,
  formatOdometer,
  formatRelativeTime,
  formatTempC,
  hasValidCoordinates,
  isLowTpms,
} from "@/lib/vehicle-status";

type FleetVehicleDetailViewProps = {
  vehicleId: string;
};

type IssueTagItem = {
  label: string;
  color: "warning" | "error" | "info";
};

type SecurityTile = {
  key: string;
  label: string;
  value: string;
  tone: "ok" | "warning" | "error" | "info" | "muted";
  /** BF-E: 소스·시각 힌트 */
  hint?: string | null;
};

type ConnectivityStep = {
  key: string;
  label: string;
  at: string | null;
  detail?: string | null;
  done: boolean;
};

const ATM_TO_PSI = 14.7;

function buildConnectivityTimeline(vehicle: VehicleDetailDto): ConnectivityStep[] {
  const sub = vehicle.telemetrySubscription;
  const sync = vehicle.syncState;
  const restReason = vehicle.freshness.lastRestSyncReason
    ? REST_SYNC_REASON_LABEL[vehicle.freshness.lastRestSyncReason]
    : null;
  const hasTelemetrySignal = Boolean(vehicle.freshness.lastTelemetryAt);
  const configReflected =
    Boolean(sub?.configSynced) ||
    Boolean(sync?.telemetryConfigSyncedAt) ||
    hasTelemetrySignal;

  return [
    {
      key: "subscribed",
      label: "실시간 구독",
      at: sub?.subscribedAt ?? null,
      done: Boolean(sub?.subscribedAt),
    },
    {
      key: "vk",
      label: "차량 키 확인",
      at: sync?.virtualKeyConfirmedAt ?? null,
      done: Boolean(sync?.virtualKeyConfirmedAt),
    },
    {
      key: "config",
      label: "실시간 설정",
      at: sync?.telemetryConfigSyncedAt ?? sub?.configCheckedAt ?? null,
      detail: sub ? (configReflected ? "반영됨" : "반영 대기") : null,
      done: configReflected,
    },
    {
      key: "baseline",
      label: "제원·초기 상태 수집",
      at: sync?.baselineCompletedAt ?? null,
      done: Boolean(sync?.baselineCompletedAt),
    },
    {
      key: "telemetry",
      label: "마지막 실시간 신호",
      at: vehicle.freshness.lastTelemetryAt,
      detail: vehicle.freshness.telemetrySource
        ? vehicle.freshness.telemetrySource === "TELEMETRY"
          ? "실시간"
          : vehicle.freshness.telemetrySource === "REST"
            ? "상세 조회"
            : "혼합"
        : null,
      done: hasTelemetrySignal,
    },
    {
      key: "rest",
      label: "마지막 상세 조회",
      at: vehicle.freshness.lastRestSyncAt,
      detail: restReason,
      done: Boolean(vehicle.freshness.lastRestSyncAt),
    },
    {
      key: "wake",
      label: "차량 기상 감지",
      at: sync?.lastWakeDetectedAt ?? null,
      done: Boolean(sync?.lastWakeDetectedAt),
    },
  ];
}

function convertTeslaTpmsToPsi(value: number | null, provider: string) {
  if (value == null) return null;
  if (provider !== "tesla") return value;
  return value * ATM_TO_PSI;
}

function collectIssueTags(vehicle: VehicleDetailDto, provider: string): IssueTagItem[] {
  const snapshot = vehicle.snapshot;
  const tags: IssueTagItem[] = [];

  if (!snapshot) return tags;

  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    tags.push({ label: "배터리 20% 미만", color: "error" });
  }
  if (snapshot.locked === false) tags.push({ label: "잠금 해제", color: "warning" });
  if (snapshot.doorsOpen) tags.push({ label: "문 개방", color: "warning" });
  if (snapshot.windowsOpen) tags.push({ label: "창문 개방", color: "warning" });
  if (snapshot.sentryMode) tags.push({ label: "센트리 모드", color: "info" });

  const tpmsValues = [
    ["전좌", snapshot.tpmsFrontLeft],
    ["전우", snapshot.tpmsFrontRight],
    ["후좌", snapshot.tpmsRearLeft],
    ["후우", snapshot.tpmsRearRight],
  ] as const;
  for (const [label, raw] of tpmsValues) {
    if (isLowTpms(convertTeslaTpmsToPsi(raw, provider))) {
      tags.push({ label: `TPMS ${label} 이상`, color: "error" });
    }
  }

  for (const event of vehicle.events.slice(0, 3)) {
    if (event.resolvedAt) continue;
    tags.push({
      label: event.message,
      color: event.type === "ALERT" ? "error" : "warning",
    });
  }

  if (snapshot.frontTrunkOpen) tags.push({ label: "프렁크 개방", color: "warning" });
  if (snapshot.rearTrunkOpen) tags.push({ label: "트렁크 개방", color: "warning" });

  const unique = new Map<string, IssueTagItem>();
  for (const tag of tags) unique.set(tag.label, tag);
  return Array.from(unique.values());
}

function buildSecurityTiles(vehicle: VehicleDetailDto): SecurityTile[] {
  const snapshot = vehicle.snapshot;
  if (!snapshot) {
    return [
      { key: "df", label: "운전석", value: "—", tone: "muted" },
      { key: "pf", label: "조수석", value: "—", tone: "muted" },
      { key: "dr", label: "좌측 후", value: "—", tone: "muted" },
      { key: "pr", label: "우측 후", value: "—", tone: "muted" },
      { key: "windows", label: "창문", value: "—", tone: "muted" },
      { key: "frunk", label: "프렁크", value: "—", tone: "muted" },
    ];
  }

  const openLabel = (value: boolean | null | undefined) =>
    value == null ? "—" : value ? "개방" : "닫힘";
  const openTone = (value: boolean | null | undefined): SecurityTile["tone"] =>
    value ? "warning" : value == null ? "muted" : "ok";

  // CI-D: 잠금·감시모드는 상단 퀵타일 — 여기엔 문 상세·창문·프렁크만
  return [
    {
      key: "df",
      label: "운전석",
      value: openLabel(snapshot.doorDfOpen),
      tone: openTone(snapshot.doorDfOpen),
    },
    {
      key: "pf",
      label: "조수석",
      value: openLabel(snapshot.doorPfOpen),
      tone: openTone(snapshot.doorPfOpen),
    },
    {
      key: "dr",
      label: "좌측 후",
      value: openLabel(snapshot.doorDrOpen),
      tone: openTone(snapshot.doorDrOpen),
    },
    {
      key: "pr",
      label: "우측 후",
      value: openLabel(snapshot.doorPrOpen),
      tone: openTone(snapshot.doorPrOpen),
    },
    {
      key: "windows",
      label: "창문",
      value: openLabel(snapshot.windowsOpen),
      tone: openTone(snapshot.windowsOpen),
    },
    {
      key: "frunk",
      label: "프렁크",
      value: openLabel(snapshot.frontTrunkOpen),
      tone: openTone(snapshot.frontTrunkOpen),
    },
  ];
}

const SHIFT_TILE_KO: Record<string, string> = {
  P: "주차",
  R: "후진",
  N: "중립",
  D: "주행",
};

/** CI-D: 3×2 퀵타일 — 잠금 · 변속 · 감시모드 · 공조 · 실내 · 실외 */
function buildQuickStatusTiles(vehicle: VehicleDetailDto): SecurityTile[] {
  const snapshot = vehicle.snapshot;

  if (!snapshot) {
    return [
      { key: "locked", label: "잠금", value: "—", tone: "muted" },
      { key: "shift", label: "변속", value: "—", tone: "muted" },
      { key: "sentry", label: "감시모드", value: "—", tone: "muted" },
      { key: "climate", label: "공조", value: "—", tone: "muted" },
      { key: "inside", label: "실내", value: "—", tone: "muted" },
      { key: "outside", label: "실외", value: "—", tone: "muted" },
    ];
  }

  const shiftRaw = snapshot.shiftState?.trim().toUpperCase() ?? "";
  const shiftToken = SHIFT_TILE_KO[shiftRaw] ? shiftRaw : shiftRaw ? shiftRaw.slice(0, 1) : "—";

  return [
    {
      key: "locked",
      label: "잠금",
      value: snapshot.locked == null ? "—" : snapshot.locked ? "잠김" : "해제",
      tone: snapshot.locked === false ? "warning" : snapshot.locked == null ? "muted" : "ok",
    },
    {
      key: "shift",
      label: "변속",
      value: shiftToken,
      tone: shiftToken === "—" ? "muted" : "ok",
    },
    {
      key: "sentry",
      label: "감시모드",
      value: snapshot.sentryMode == null ? "—" : snapshot.sentryMode ? "활성" : "비활성",
      tone: snapshot.sentryMode ? "info" : snapshot.sentryMode == null ? "muted" : "ok",
    },
    {
      key: "climate",
      label: "공조",
      value: snapshot.climateOn == null ? "—" : snapshot.climateOn ? "ON" : "OFF",
      tone: snapshot.climateOn ? "info" : snapshot.climateOn == null ? "muted" : "ok",
    },
    {
      key: "inside",
      label: "실내",
      value: formatTempC(snapshot.insideTempC),
      tone: snapshot.insideTempC == null ? "muted" : "ok",
    },
    {
      key: "outside",
      label: "실외",
      value: formatTempC(snapshot.outsideTempC),
      tone: snapshot.outsideTempC == null ? "muted" : "ok",
    },
  ];
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function securityToneClass(tone: SecurityTile["tone"]) {
  switch (tone) {
    case "warning":
      return "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10";
    case "error":
      return "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10";
    case "info":
      return "border-blue-light-200 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/10";
    case "ok":
      return "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]";
    default:
      return "border-gray-100 bg-transparent dark:border-gray-800";
  }
}

export function FleetVehicleDetailView({ vehicleId }: FleetVehicleDetailViewProps) {
  const router = useRouter();
  const { data, isLoading, isError, error, isFetching, refetch } = useVehicleDetail(vehicleId);
  const refreshVehicles = useVehicleRefresh();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirmingKey, setIsConfirmingKey] = useState(false);
  const [isRetryingBaseline, setIsRetryingBaseline] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [successDisconnectOpen, setSuccessDisconnectOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [vinCopied, setVinCopied] = useState(false);
  const [specsExpanded, setSpecsExpanded] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(true);
  const [techDetailsExpanded, setTechDetailsExpanded] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleConfirmKey() {
    setIsConfirmingKey(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/virtual-key/confirm`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setActionMessage(body.error ?? "키 연결 확인에 실패했습니다.");
        return;
      }
      setActionMessage("차량 키가 확인되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("키 연결 확인 요청 중 오류가 발생했습니다.");
    } finally {
      setIsConfirmingKey(false);
    }
  }

  async function handleRetryBaseline() {
    setIsRetryingBaseline(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/baseline`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setActionMessage(
          body.error
            ? `제원·상태 불러오기 실패 (자동 기상 없음): ${body.error}`
            : "제원·상태 다시 불러오기에 실패했습니다. 차량이 깨어 있을 때 다시 시도하세요.",
        );
        return;
      }
      setActionMessage("제원·초기 상태 수집이 완료되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("제원·상태 요청 중 오류가 발생했습니다.");
    } finally {
      setIsRetryingBaseline(false);
    }
  }

  async function handleDisconnectTelemetry() {
    setIsDisconnecting(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/telemetry/disconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        teslaUnsubscribe?: { ok?: boolean; error?: string };
      };
      if (!response.ok) {
        setActionMessage(body.error ?? "실시간 연동 끄기에 실패했습니다.");
        return;
      }
      setConfirmDisconnectOpen(false);
      setSuccessDisconnectOpen(true);
      if (body.teslaUnsubscribe && body.teslaUnsubscribe.ok === false) {
        setActionMessage(
          `연동은 꺼짐으로 처리되었습니다. Tesla 구독 해제 재시도가 필요할 수 있습니다: ${body.teslaUnsubscribe.error ?? ""}`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("실시간 연동 끄기 요청 중 오류가 발생했습니다.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleReconnectTelemetry() {
    setIsReconnecting(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/telemetry/reconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        subscribe?: { ok?: boolean; alreadyConfigured?: boolean; error?: string };
        virtualKey?: { ok?: boolean; error?: string };
      };
      if (!response.ok) {
        setActionMessage(
          body.error
            ? `실시간 연동 다시 켜기 실패: ${body.error}. 연동을 껐을 때 Tesla 설정이 삭제되므로 다시 등록이 필요합니다.`
            : "실시간 연동 다시 켜기에 실패했습니다.",
        );
        return;
      }
      setActionMessage(
        body.subscribe?.alreadyConfigured
          ? "실시간 설정이 이미 있습니다. 수신을 기다립니다."
          : body.virtualKey?.ok
            ? "실시간 설정 등록·키 확인이 완료되었습니다. 차량이 깨어 있으면 곧 신호가 들어옵니다."
            : `설정 등록은 반영되었습니다. 키 확인: ${body.virtualKey?.error ?? "미확인"}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("실시간 연동 다시 켜기 요청 중 오류가 발생했습니다.");
    } finally {
      setIsReconnecting(false);
    }
  }

  async function handleUnlinkFromFleet() {
    setIsUnlinking(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/unlink`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setActionMessage(body.error ?? "플릿에서 제거하지 못했습니다.");
        return;
      }
      setConfirmUnlinkOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      router.push("/vehicles");
    } catch {
      setActionMessage("플릿 제거 요청 중 오류가 발생했습니다.");
    } finally {
      setIsUnlinking(false);
    }
  }

  async function handleCopyVin(vin: string) {
    try {
      await navigator.clipboard.writeText(vin);
      setVinCopied(true);
      window.setTimeout(() => setVinCopied(false), 2000);
    } catch {
      setActionMessage("VIN 복사에 실패했습니다.");
    }
  }

  if (isLoading) {
    return <p className="text-theme-sm text-gray-500">차량 상세를 불러오는 중...</p>;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <p className="text-error-600">{error?.message ?? "차량 정보를 불러오지 못했습니다."}</p>
        <Link
          href="/vehicles"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-theme-sm dark:border-gray-700"
        >
          목록으로
        </Link>
      </div>
    );
  }

  const vehicle = data.vehicle;
  const snapshot = vehicle.snapshot;
  const status = snapshot?.status ?? "OFFLINE";
  const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";
  const issueTags = collectIssueTags(vehicle, data.provider);
  const securityTiles = buildSecurityTiles(vehicle);
  const quickStatusTiles = buildQuickStatusTiles(vehicle);
  const lifecycle = vehicle.syncState?.lifecycle ?? null;
  const guidance = lifecycleGuidance(lifecycle);
  const trimLabel = labelTrimBadging(vehicle.trimBadging);
  const colorLabel = formatColorBadge(vehicle);
  const carTypeLabel = labelCarType(vehicle.carType);
  const hasLocation = hasValidCoordinates(snapshot?.latitude, snapshot?.longitude);
  const hasTelemetrySignal = Boolean(vehicle.freshness.lastTelemetryAt);
  const showConfigSyncedWarning =
    vehicle.telemetrySubscription?.active === true &&
    vehicle.telemetrySubscription.configSynced === false &&
    lifecycle !== "TELEMETRY_DISCONNECTED" &&
    !hasTelemetrySignal;
  const dataFreshnessAt =
    vehicle.freshness.lastTelemetryAt ?? snapshot?.lastUpdatedAt ?? null;
  const lastSignalAt =
    vehicle.freshness.lastTelemetryAt ??
    snapshot?.sleepInferredAt ??
    snapshot?.lastUpdatedAt ??
    null;
  const teslaDisplayName = vehicle.teslaDisplayName?.trim() || null;
  const connectivityTimeline = buildConnectivityTimeline(vehicle);
  const baselineLastError = vehicle.syncState?.baselineLastError?.trim() || null;
  const subscriptionLastError = vehicle.telemetrySubscription?.lastError?.trim() || null;
  const hasOpsErrors = Boolean(baselineLastError || subscriptionLastError);
  const tpmsSourceAt =
    vehicle.freshness.lastRestSyncAt ??
    vehicle.syncState?.baselineCompletedAt ??
    vehicle.specsSyncedAt ??
    null;
  const tpmsSourceHint = tpmsSourceAt
    ? `마지막 상세 조회 기준 · ${formatRelativeTime(tpmsSourceAt)}`
    : "상세 조회 시각 없음 (오래되었을 수 있음)";
  const restReasonLabel = vehicle.freshness.lastRestSyncReason
    ? REST_SYNC_REASON_LABEL[vehicle.freshness.lastRestSyncReason]
    : "-";
  const rangeKmLabel =
    snapshot?.rangeKm != null && Number.isFinite(snapshot.rangeKm)
      ? `주행 가능 ${Math.round(snapshot.rangeKm).toLocaleString("ko-KR")}km`
      : null;
  const subscriptionStatusLabel = vehicle.telemetrySubscription
    ? vehicle.telemetrySubscription.active
      ? vehicle.telemetrySubscription.configSynced || hasTelemetrySignal
        ? "활성 · 설정 반영됨"
        : "활성 · 설정 반영 대기"
      : vehicle.telemetrySubscription.disconnectReason
        ? `꺼짐 · ${DISCONNECT_REASON_LABEL[vehicle.telemetrySubscription.disconnectReason]}`
        : "비활성"
    : "-";
  const telemetrySourceLabel =
    vehicle.freshness.telemetrySource === "TELEMETRY"
      ? "실시간"
      : vehicle.freshness.telemetrySource === "REST"
        ? "상세 조회"
        : vehicle.freshness.telemetrySource === "MIXED"
          ? "혼합"
          : (vehicle.freshness.telemetrySource ?? "-");

  const mapVehicle: MapVehicle[] =
    snapshot?.status != null && hasLocation
      ? [
          {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            status: snapshot.status,
            latitude: snapshot.latitude!,
            longitude: snapshot.longitude!,
            batteryPercent: snapshot.batteryPercent,
            ignitionOn: snapshot.ignitionOn,
            chargingStatus: snapshot.chargingStatus,
            lifecycle,
            carType: vehicle.carType,
          },
        ]
      : [];

  const tpms = snapshot
    ? {
        fl: convertTeslaTpmsToPsi(snapshot.tpmsFrontLeft, data.provider),
        fr: convertTeslaTpmsToPsi(snapshot.tpmsFrontRight, data.provider),
        rl: convertTeslaTpmsToPsi(snapshot.tpmsRearLeft, data.provider),
        rr: convertTeslaTpmsToPsi(snapshot.tpmsRearRight, data.provider),
      }
    : null;
  /** CI: TPMS 값이 하나라도 있으면 「타이어 · 차체」구역 표시 */
  const showBodyDiagram = Boolean(
    tpms &&
      (tpms.fl != null || tpms.fr != null || tpms.rl != null || tpms.rr != null),
  );

  return (
    <>
      <FleetToolbar
        title={vehicle.plateNumber}
        description={`${vehicle.model} · ${vehicle.year}`}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/vehicles"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-theme-sm dark:border-gray-700"
        >
          목록으로
        </Link>
        <Link
          href="/map"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-theme-sm dark:border-gray-700"
        >
          전체 지도
        </Link>
      </div>

      {/* UX2-F: 실시간 차량 정보 | 현재 위치 */}
      {vehicle.telemetryValueMonitor ? (
        <TelemetryValueMonitorCard lines={vehicle.telemetryValueMonitor.lines} />
      ) : null}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            실시간 차량 정보
          </h4>
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <Badge color={vehicleStatusBadgeColor(status)}>
              {STATUS_LABEL[status]}
            </Badge>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <div className="min-w-[7.5rem] max-w-[11rem] flex-1 sm:flex-none">
                <BatteryProgressBar percent={snapshot?.batteryPercent ?? null} />
              </div>
              {rangeKmLabel ? (
                <span className="shrink-0 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  {rangeKmLabel}
                </span>
              ) : null}
            </div>
            {issueTags.length === 0 ? (
              <span className="text-theme-sm text-gray-400">이상 없음</span>
            ) : (
              <a
                href="#vehicle-security"
                className="text-theme-sm font-medium text-error-600 hover:underline dark:text-error-400"
              >
                이슈 {issueTags.length}
              </a>
            )}
            {status !== "ASLEEP" ? (
              <span
                className="ml-auto text-theme-xs text-gray-400"
                title={formatDateTime(dataFreshnessAt)}
              >
                데이터 {formatRelativeTime(dataFreshnessAt)}
              </span>
            ) : null}
          </div>
          {status === "ASLEEP" && lastSignalAt ? (
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              마지막 신호:{" "}
              <span title={formatDateTime(lastSignalAt)}>
                {formatRelativeTime(lastSignalAt)}
              </span>{" "}
              (절전 모드)
            </p>
          ) : null}

          {shouldShowChargingSessionCard(chargingStatus) ? (
            <ChargingSessionCard
              chargingStatus={chargingStatus}
              batteryPercent={snapshot?.batteryPercent}
              rangeKm={snapshot?.rangeKm}
              chargerPowerKw={snapshot?.chargerPowerKw}
              chargeLimitSoc={snapshot?.chargeLimitSoc}
              chargingPowerKind={snapshot?.chargingPowerKind}
            />
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {quickStatusTiles.map((tile) => (
              <div
                key={tile.key}
                className={`rounded-xl border px-3 py-3 sm:px-4 ${securityToneClass(tile.tone)}`}
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{tile.label}</p>
                <p
                  className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90"
                  title={
                    tile.key === "shift" && tile.value !== "—"
                      ? SHIFT_TILE_KO[tile.value]
                      : undefined
                  }
                >
                  {tile.value}
                </p>
              </div>
            ))}
          </div>

          {showBodyDiagram && tpms ? (
            <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800">
              <h5 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                타이어 · 차체
              </h5>
              <p
                className="mb-3 text-theme-xs text-gray-500 dark:text-gray-400"
                title={formatDateTime(tpmsSourceAt)}
              >
                출처: {tpmsSourceHint}
              </p>
              <TpmsDiagram
                frontLeft={tpms.fl}
                frontRight={tpms.fr}
                rearLeft={tpms.rl}
                rearRight={tpms.rr}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            현재 위치
          </h4>
          {mapVehicle.length > 0 ? (
            <VehicleMap
              vehicles={mapVehicle}
              selectedId={vehicle.id}
              height={260}
              centerOnSelected
              hideSelectionCard
            />
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center dark:border-gray-700 dark:bg-white/[0.02]">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                위치가 아직 없어요
              </p>
              <p className="mt-2 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
                주차(절전) 중에는 위치가 비어 있을 수 있어요. 운행이 시작되면 실시간으로
                갱신됩니다. 추정 좌표는 사용하지 않습니다.
              </p>
              {status === "ASLEEP" ? (
                <p className="mt-3 text-theme-xs text-gray-400">
                  현재 주차(절전) · 깨어난 뒤 위치 수신을 확인하세요.
                </p>
              ) : null}
            </div>
          )}
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h5 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                인근 충전소
              </h5>
              {snapshot?.nearbyChargingMeta?.capturedAt ? (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  수집 {formatRelativeTime(snapshot.nearbyChargingMeta.capturedAt)}
                  {snapshot.nearbyChargingMeta.capturedAt
                    ? ` · ${formatDateTime(snapshot.nearbyChargingMeta.capturedAt)}`
                    : ""}
                </p>
              ) : null}
            </div>
            {mapVehicle.length === 0 ? (
              <p className="text-theme-xs text-gray-400">위치가 없어 목록을 표시할 수 없습니다.</p>
            ) : snapshot?.nearbyChargingSites && snapshot.nearbyChargingSites.length > 0 ? (
              <ul className="space-y-2">
                {snapshot.nearbyChargingSites.slice(0, 5).map((site) => (
                  <li
                    key={`${site.name}-${site.distanceKm}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800"
                  >
                    <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {site.name}
                    </span>
                    <span className="shrink-0 text-theme-xs text-gray-500">
                      {site.distanceKm.toLocaleString("ko-KR")} km
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 dark:border-gray-700">
                <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                  주행 중 — 주차 후 갱신
                </p>
                <p className="mt-1 text-theme-xs text-gray-400">
                  또는 차량이 깨어 있을 때 「제원·상태 다시 불러오기」로 갱신할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {guidance ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-500/30 dark:bg-warning-500/10 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {lifecycle ? (
                <Badge color={lifecycleBadgeColor(lifecycle)}>
                  {LIFECYCLE_LABEL[lifecycle]}
                </Badge>
              ) : null}
              <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
                {guidance.title}
              </h4>
            </div>
            <p className="mt-2 text-theme-sm text-gray-600 dark:text-gray-300">{guidance.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {guidance.actions.includes("confirm_key") ? (
                <Button
                  size="sm"
                  onClick={() => void handleConfirmKey()}
                  disabled={isConfirmingKey}
                >
                  {isConfirmingKey ? "확인 중..." : "키 연결 확인"}
                </Button>
              ) : null}
              {guidance.actions.includes("retry_baseline") ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRetryBaseline()}
                  disabled={isRetryingBaseline}
                >
                  {isRetryingBaseline ? "불러오는 중..." : "제원·상태 다시 불러오기"}
                </Button>
              ) : null}
              {guidance.actions.includes("reconnect_telemetry") ? (
                <Button
                  size="sm"
                  onClick={() => void handleReconnectTelemetry()}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? "연결 중..." : "실시간 연동 다시 켜기"}
                </Button>
              ) : null}
              <Link href="/settings">
                <Button size="sm" variant="outline">
                  연동 설정
                </Button>
              </Link>
            </div>
            {actionMessage ? (
              <p className="mt-3 text-theme-sm text-gray-700 dark:text-gray-300">{actionMessage}</p>
            ) : null}
          </div>
        ) : null}

        {!guidance && actionMessage ? (
          <p className="text-theme-sm text-gray-600 dark:text-gray-300">{actionMessage}</p>
        ) : null}

        {showConfigSyncedWarning ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-500/30 dark:bg-warning-500/10 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="warning">수신 지연 가능</Badge>
              <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
                실시간 데이터 지연 가능
              </h4>
            </div>
            <p className="mt-2 text-theme-sm text-gray-600 dark:text-gray-300">
              실시간 연동은 켜져 있지만 최근 신호가 없습니다. 「실시간 연동 다시 켜기」 또는
              차량이 깨어 있을 때 「제원·상태 다시 불러오기」를 시도해 보세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleReconnectTelemetry()}
                disabled={isReconnecting}
              >
                {isReconnecting ? "연결 중..." : "실시간 연동 다시 켜기"}
              </Button>
              <a href="#vehicle-ops">
                <Button size="sm" variant="outline">
                  운영 액션
                </Button>
              </a>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <button
              type="button"
              className="mb-2 flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setSpecsExpanded((open) => !open)}
              aria-expanded={specsExpanded}
            >
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  제원 · 식별
                </h4>
                {!specsExpanded ? (
                  <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                    {vehicle.oemVehicleId
                      ? `VIN ···${vehicle.oemVehicleId.slice(-6)}`
                      : "제원 보기"}
                  </p>
                ) : null}
              </div>
              <span className="text-theme-sm text-brand-500">
                {specsExpanded ? "접기" : "펼치기"}
              </span>
            </button>
            {specsExpanded ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField label="표시 모델" value={vehicle.model} />
                <InfoField label="연식" value={String(vehicle.year)} />
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    VIN
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {vehicle.oemVehicleId ?? "-"}
                    </p>
                    {vehicle.oemVehicleId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCopyVin(vehicle.oemVehicleId!)}
                      >
                        {vinCopied ? "복사됨" : "복사"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <InfoField label="car_type" value={carTypeLabel ?? vehicle.carType ?? "-"} />
                <InfoField label="트림" value={trimLabel ?? vehicle.trimBadging ?? "-"} />
                <InfoField label="외장색" value={colorLabel ?? "-"} />
                {teslaDisplayName ? (
                  <InfoField label="Tesla 표시명" value={teslaDisplayName} />
                ) : null}
                <InfoField label="SW 버전" value={snapshot?.softwareVersion ?? "-"} />
                <InfoField
                  label="제원 동기화"
                  value={formatDateTime(vehicle.specsSyncedAt)}
                />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {vehicle.oemVehicleId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopyVin(vehicle.oemVehicleId!)}
                  >
                    {vinCopied ? "VIN 복사됨" : "VIN 복사"}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setSpecsExpanded(true)}>
                  제원 전체 보기
                </Button>
              </div>
            )}
          </div>

          <div
            id="vehicle-ops"
            className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6"
          >
            <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              운영 · 연동
            </h4>
            <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
              조회 카드와 분리된 관리자 조치 · 연동 타임라인 · 최근 오류
            </p>
            <div className="flex flex-wrap gap-2">
              {lifecycle !== "TELEMETRY_DISCONNECTED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDisconnectOpen(true)}
                  disabled={isDisconnecting}
                >
                  실시간 연동 끄기
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleReconnectTelemetry()}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? "연결 중..." : "실시간 연동 다시 켜기"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRetryBaseline()}
                disabled={isRetryingBaseline || lifecycle === "TELEMETRY_DISCONNECTED"}
              >
                {isRetryingBaseline ? "불러오는 중..." : "제원·상태 다시 불러오기"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmUnlinkOpen(true)}
                disabled={isUnlinking}
              >
                플릿에서 제거
              </Button>
            </div>

            <h5 className="mb-3 mt-8 text-sm font-semibold text-gray-800 dark:text-white/90">
              연동 타임라인
            </h5>
            <ol className="space-y-3 border-l border-gray-200 pl-4 dark:border-gray-700">
              {connectivityTimeline.map((step) => (
                <li key={step.key} className="relative">
                  <span
                    className={`absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full ${
                      step.done
                        ? "bg-success-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={`text-theme-sm font-medium ${
                        step.done
                          ? "text-gray-800 dark:text-white/90"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className="text-theme-xs text-gray-500 dark:text-gray-400"
                      title={formatDateTime(step.at)}
                    >
                      {step.at ? formatRelativeTime(step.at) : "—"}
                    </p>
                  </div>
                  {step.detail ? (
                    <p className="text-theme-xs text-gray-400">{step.detail}</p>
                  ) : null}
                </li>
              ))}
            </ol>

            <h5 className="mb-3 mt-8 text-sm font-semibold text-gray-800 dark:text-white/90">
              데이터 신선도
            </h5>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                label="마지막 실시간 신호"
                value={formatDateTime(vehicle.freshness.lastTelemetryAt)}
              />
              <InfoField
                label="마지막 상세 조회"
                value={formatDateTime(vehicle.freshness.lastRestSyncAt)}
              />
              <InfoField label="상세 조회 사유" value={restReasonLabel} />
              <InfoField label="데이터 출처" value={telemetrySourceLabel} />
              <InfoField label="구독" value={subscriptionStatusLabel} />
              <InfoField
                label="연동 끔 시각"
                value={formatDateTime(vehicle.telemetrySubscription?.disconnectedAt ?? null)}
              />
            </div>

            <div className="mt-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setTechDetailsExpanded((open) => !open)}
                aria-expanded={techDetailsExpanded}
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  기술 상세
                </span>
                <span className="text-theme-sm text-brand-500">
                  {techDetailsExpanded ? "접기" : "펼치기"}
                </span>
              </button>
              {techDetailsExpanded ? (
                <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                  <InfoField label="lifecycle" value={lifecycle ?? "-"} />
                  <InfoField
                    label="configSynced"
                    value={
                      vehicle.telemetrySubscription
                        ? String(vehicle.telemetrySubscription.configSynced)
                        : "-"
                    }
                  />
                  <InfoField
                    label="configCheckedAt"
                    value={formatDateTime(
                      vehicle.telemetrySubscription?.configCheckedAt ?? null,
                    )}
                  />
                  <InfoField
                    label="telemetryConfigSyncedAt"
                    value={formatDateTime(vehicle.syncState?.telemetryConfigSyncedAt ?? null)}
                  />
                  <InfoField
                    label="lastRestSyncReason"
                    value={vehicle.freshness.lastRestSyncReason ?? "-"}
                  />
                  <InfoField
                    label="telemetrySource"
                    value={vehicle.freshness.telemetrySource ?? "-"}
                  />
                  <InfoField
                    label="isAsleepInferred"
                    value={snapshot?.isAsleepInferred == null ? "-" : String(snapshot.isAsleepInferred)}
                  />
                  <InfoField label="VIN" value={vehicle.oemVehicleId ?? "-"} />
                  <InfoField label="provider" value={data.provider} />
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setErrorsExpanded((open) => !open)}
                aria-expanded={errorsExpanded}
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  최근 오류
                  {hasOpsErrors ? (
                    <span className="ml-2 text-theme-xs font-medium text-warning-600 dark:text-warning-400">
                      기록 있음
                    </span>
                  ) : (
                    <span className="ml-2 text-theme-xs font-normal text-gray-400">없음</span>
                  )}
                </span>
                <span className="text-theme-sm text-brand-500">
                  {errorsExpanded ? "접기" : "펼치기"}
                </span>
              </button>
              {errorsExpanded ? (
                <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                  {!hasOpsErrors ? (
                    <p className="text-theme-sm text-gray-500">
                      저장된 제원 수집/구독 오류가 없습니다.
                    </p>
                  ) : null}
                  {baselineLastError ? (
                    <div>
                      <p className="text-theme-xs font-medium text-gray-500">제원·상태 수집 오류</p>
                      <p className="mt-1 break-all text-theme-sm text-gray-700 dark:text-gray-300">
                        {baselineLastError}
                      </p>
                      {vehicle.syncState?.baselineCompletedAt ? (
                        <p className="mt-1 text-theme-xs text-gray-400">
                          이후 수집 완료:{" "}
                          {formatRelativeTime(vehicle.syncState.baselineCompletedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {subscriptionLastError ? (
                    <div>
                      <p className="text-theme-xs font-medium text-gray-500">구독 오류</p>
                      <p className="mt-1 break-all text-theme-sm text-gray-700 dark:text-gray-300">
                        {subscriptionLastError}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* 배터리 · 잠금 상세 */}
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              배터리 · 주행
            </h4>
            <BatteryHealthGauge
              percent={snapshot?.batteryPercent ?? null}
              rangeKm={snapshot?.rangeKm ?? null}
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField label="주행거리" value={formatOdometer(snapshot?.odometerKm ?? null)} />
              <InfoField label="미운행" value={vehicle.isIdle ? "예" : "아니오"} />
              <InfoField
                label="시동"
                value={snapshot?.ignitionOn == null ? "-" : snapshot.ignitionOn ? "ON" : "OFF"}
              />
              <InfoField
                label="정비"
                value={snapshot?.serviceStatus ? SERVICE_STATUS_LABEL[snapshot.serviceStatus] : "-"}
              />
              <InfoField
                label="충전 한도"
                value={
                  snapshot?.chargeLimitSoc != null
                    ? `${Math.round(snapshot.chargeLimitSoc)}%`
                    : "-"
                }
              />
              <InfoField
                label="충전기 출력"
                value={
                  snapshot?.chargerPowerKw != null
                    ? `${snapshot.chargerPowerKw} kW`
                    : "-"
                }
              />
            </div>
          </div>

          <div
            id="vehicle-security"
            className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                문 · 창문 상세
              </h4>
              {issueTags.length > 0 ? (
                <span className="text-theme-xs text-gray-500">
                  요약 이슈 {issueTags.length}건
                </span>
              ) : null}
            </div>
            <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
              잠금·문(종합)·트렁크·공조는 상단 퀵타일을 보세요.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {securityTiles.map((tile) => (
                <div
                  key={tile.key}
                  className={`rounded-xl border px-4 py-3 ${securityToneClass(tile.tone)}`}
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{tile.label}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {tile.value}
                  </p>
                </div>
              ))}
            </div>
            {issueTags.some((t) => t.label.startsWith("TPMS") || t.label.includes("배터리")) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {issueTags
                  .filter(
                    (t) =>
                      t.label.startsWith("TPMS") ||
                      t.label.includes("배터리") ||
                      t.color === "error",
                  )
                  .slice(0, 4)
                  .map((tag) => (
                    <Badge key={tag.label} color={tag.color} size="sm">
                      {tag.label}
                    </Badge>
                  ))}
              </div>
            ) : null}
          </div>
        </div>

        <div id="vehicle-events" className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            최근 이벤트
          </h4>
          <ul className="space-y-3">
            {vehicle.events.slice(0, 12).map((event) => {
              const resolved = Boolean(event.resolvedAt);
              return (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
                >
                  <div>
                    <p
                      className={`text-theme-sm font-medium ${
                        resolved
                          ? "text-gray-400 line-through dark:text-gray-500"
                          : "text-gray-800 dark:text-white/90"
                      }`}
                    >
                      {event.message}
                    </p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      발생 {formatDateTime(event.occurredAt)}
                      {resolved
                        ? ` · 해소 ${formatRelativeTime(event.resolvedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge color={event.type === "ALERT" ? "error" : "warning"} size="sm">
                      {event.type}
                    </Badge>
                    {resolved ? (
                      <Badge color="light" size="sm">
                        해소됨
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {vehicle.events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 dark:border-gray-700">
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                기록된 이벤트가 없습니다.
              </p>
              <p className="mt-1 text-theme-xs text-gray-400">
                수집 파이프가 비어 있을 수 있어, 이상 없음을 단정하지는 않습니다. 배터리·잠금·TPMS
                요약 스트립을 함께 확인하세요.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        className="max-w-lg p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          실시간 연동 끄기
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          이 차량의 <strong>실시간 수신이 중지</strong>됩니다. 차량 키는 자동 삭제되지 않습니다.
          과금·프라이버시 목적의 연동 해지에 가깝습니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmDisconnectOpen(false)}
            disabled={isDisconnecting}
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={() => void handleDisconnectTelemetry()}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? "끄는 중..." : "연동 끄기"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={successDisconnectOpen}
        onClose={() => setSuccessDisconnectOpen(false)}
        className="max-w-lg p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          실시간 연동 끔 완료
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          보리차 FMS와의 실시간 연동이 해제되었습니다. 완벽한 보안을 위해 Tesla 모바일 앱
          또는 차량 화면의 <strong>안전</strong> 메뉴에서 <strong>bori-fleet Virtual Key</strong>를
          함께 삭제해 주세요.
        </p>
        <div className="mt-6 flex justify-end">
          <Button size="sm" onClick={() => setSuccessDisconnectOpen(false)}>
            확인
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmUnlinkOpen}
        onClose={() => setConfirmUnlinkOpen(false)}
        className="max-w-lg p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          플릿에서 제거
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          목록에서 이 차량이 제거되며 실시간 구독도 해제됩니다. 차량 키는 자동 삭제되지
          않습니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmUnlinkOpen(false)}
            disabled={isUnlinking}
          >
            취소
          </Button>
          <Button size="sm" onClick={() => void handleUnlinkFromFleet()} disabled={isUnlinking}>
            {isUnlinking ? "제거 중..." : "플릿에서 제거"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
