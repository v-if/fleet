"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BatteryHealthGauge } from "@/components/fleet/battery-health-gauge";
import { TpmsDiagram } from "@/components/fleet/tpms-diagram";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useRouter } from "next/navigation";
import { useVehicleDetail, useVehicleRefresh } from "@/hooks/use-vehicles";
import {
  chargingStatusBadgeColor,
  providerLabel,
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
  shouldShowLifecycleBadge,
} from "@/lib/vehicle-lifecycle";
import {
  CHARGING_STATUS_LABEL,
  SERVICE_STATUS_LABEL,
  STATUS_LABEL,
  formatDateTime,
  formatLocationSummary,
  formatOdometer,
  formatRelativeTime,
  formatSocPercent,
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

  return [
    {
      key: "subscribed",
      label: "Telemetry 구독",
      at: sub?.subscribedAt ?? null,
      done: Boolean(sub?.subscribedAt),
    },
    {
      key: "vk",
      label: "Virtual Key 확인",
      at: sync?.virtualKeyConfirmedAt ?? null,
      done: Boolean(sync?.virtualKeyConfirmedAt),
    },
    {
      key: "config",
      label: "Telemetry config",
      at: sync?.telemetryConfigSyncedAt ?? sub?.configCheckedAt ?? null,
      detail: sub
        ? sub.configSynced
          ? "synced"
          : "미동기(configSynced false)"
        : null,
      done: Boolean(sub?.configSynced || sync?.telemetryConfigSyncedAt),
    },
    {
      key: "baseline",
      label: "Baseline 완료",
      at: sync?.baselineCompletedAt ?? null,
      done: Boolean(sync?.baselineCompletedAt),
    },
    {
      key: "telemetry",
      label: "마지막 Telemetry",
      at: vehicle.freshness.lastTelemetryAt,
      detail: vehicle.freshness.telemetrySource,
      done: Boolean(vehicle.freshness.lastTelemetryAt),
    },
    {
      key: "rest",
      label: "마지막 REST",
      at: vehicle.freshness.lastRestSyncAt,
      detail: restReason,
      done: Boolean(vehicle.freshness.lastRestSyncAt),
    },
    {
      key: "wake",
      label: "마지막 wake 감지",
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
      { key: "locked", label: "잠금", value: "—", tone: "muted" },
      { key: "doors", label: "문", value: "—", tone: "muted" },
      { key: "windows", label: "창문", value: "—", tone: "muted" },
      { key: "frunk", label: "프렁크", value: "—", tone: "muted" },
      { key: "trunk", label: "트렁크", value: "—", tone: "muted" },
      { key: "sentry", label: "센트리", value: "—", tone: "muted" },
    ];
  }

  const openLabel = (value: boolean | null | undefined) =>
    value == null ? "—" : value ? "개방" : "닫힘";
  const openTone = (value: boolean | null | undefined): SecurityTile["tone"] =>
    value ? "warning" : value == null ? "muted" : "ok";

  return [
    {
      key: "locked",
      label: "잠금",
      value: snapshot.locked == null ? "—" : snapshot.locked ? "잠김" : "해제",
      tone: snapshot.locked === false ? "warning" : snapshot.locked == null ? "muted" : "ok",
    },
    {
      key: "doors",
      label: "문(종합)",
      value: openLabel(snapshot.doorsOpen),
      tone: openTone(snapshot.doorsOpen),
    },
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
    {
      key: "trunk",
      label: "트렁크",
      value: openLabel(snapshot.rearTrunkOpen),
      tone: openTone(snapshot.rearTrunkOpen),
    },
    {
      key: "sentry",
      label: "센트리",
      value: snapshot.sentryMode == null ? "—" : snapshot.sentryMode ? "활성" : "비활성",
      tone: snapshot.sentryMode ? "info" : snapshot.sentryMode == null ? "muted" : "ok",
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
      setActionMessage("Virtual Key가 확인되었습니다.");
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
            ? `Baseline 실패 (자동 wake 없음): ${body.error}`
            : "Baseline 재시도에 실패했습니다. 차량이 깨어 있을 때 다시 시도하세요.",
        );
        return;
      }
      setActionMessage("Baseline(제원·스냅샷) 동기화가 완료되었습니다.");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("Baseline 요청 중 오류가 발생했습니다.");
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
        setActionMessage(body.error ?? "Telemetry 연동 해제에 실패했습니다.");
        return;
      }
      setConfirmDisconnectOpen(false);
      setSuccessDisconnectOpen(true);
      if (body.teslaUnsubscribe && body.teslaUnsubscribe.ok === false) {
        setActionMessage(
          `DB는 단절 처리되었습니다. Tesla 구독 해제 재시도가 필요할 수 있습니다: ${body.teslaUnsubscribe.error ?? ""}`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("Telemetry 연동 해제 요청 중 오류가 발생했습니다.");
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
            ? `재연결 실패: ${body.error}. 연동 해지 시 Tesla config가 삭제되므로 Vehicle Command Proxy로 fleet_telemetry_config를 다시 등록해야 합니다.`
            : "Telemetry 재연결에 실패했습니다.",
        );
        return;
      }
      setActionMessage(
        body.subscribe?.alreadyConfigured
          ? "Telemetry config가 이미 있습니다. 수신을 기다립니다."
          : body.virtualKey?.ok
            ? "Telemetry config 재등록·VK 확인이 완료되었습니다. 차량이 깨어 있으면 곧 스트림이 들어옵니다."
            : `config 재등록은 반영되었습니다. Virtual Key 확인: ${body.virtualKey?.error ?? "미확인"}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("Telemetry 재연결 요청 중 오류가 발생했습니다.");
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
  const lifecycle = vehicle.syncState?.lifecycle ?? null;
  const guidance = lifecycleGuidance(lifecycle);
  const trimLabel = labelTrimBadging(vehicle.trimBadging);
  const colorLabel = formatColorBadge(vehicle);
  const carTypeLabel = labelCarType(vehicle.carType);
  const asleepInferred = status === "ASLEEP" && snapshot?.isAsleepInferred === true;
  const hasLocation = hasValidCoordinates(snapshot?.latitude, snapshot?.longitude);
  const showConfigSyncedWarning =
    vehicle.telemetrySubscription?.active === true &&
    vehicle.telemetrySubscription.configSynced === false &&
    lifecycle !== "TELEMETRY_DISCONNECTED";
  const dataFreshnessAt =
    vehicle.freshness.lastTelemetryAt ?? snapshot?.lastUpdatedAt ?? null;
  const teslaDisplayName = vehicle.teslaDisplayName?.trim() || null;
  const connectivityTimeline = buildConnectivityTimeline(vehicle);
  const baselineLastError = vehicle.syncState?.baselineLastError?.trim() || null;
  const subscriptionLastError = vehicle.telemetrySubscription?.lastError?.trim() || null;
  const hasOpsErrors = Boolean(baselineLastError || subscriptionLastError);
  const climateSourceHint = vehicle.freshness.lastTelemetryAt
    ? `Telemetry · ${formatRelativeTime(vehicle.freshness.lastTelemetryAt)}`
    : "Telemetry 미수신 — 값이 오래되었을 수 있습니다";
  const tpmsSourceAt =
    vehicle.freshness.lastRestSyncAt ??
    vehicle.syncState?.baselineCompletedAt ??
    vehicle.specsSyncedAt ??
    null;
  const tpmsSourceHint = tpmsSourceAt
    ? `REST Baseline 유산 · ${formatRelativeTime(tpmsSourceAt)}`
    : "REST Baseline 유산 · 동기화 시각 없음 (노후 가능)";
  const restReasonLabel = vehicle.freshness.lastRestSyncReason
    ? REST_SYNC_REASON_LABEL[vehicle.freshness.lastRestSyncReason]
    : "-";

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

  return (
    <>
      <FleetToolbar
        title={vehicle.plateNumber}
        description={`${vehicle.model} (${vehicle.year})`}
        provider={providerLabel(data.provider)}
        lastUpdatedAt={formatDateTime(snapshot?.lastUpdatedAt ?? null)}
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

      {/* A. Summary strip — VD-1 */}
      <div className="sticky top-0 z-20 mb-6 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-theme-xs backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 lg:px-5">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <Badge color={vehicleStatusBadgeColor(status)}>
            {asleepInferred ? "취침 (추론)" : STATUS_LABEL[status]}
          </Badge>
          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {formatSocPercent(snapshot?.batteryPercent ?? null)}
          </span>
          <Badge color={chargingStatusBadgeColor(chargingStatus)} size="sm">
            {CHARGING_STATUS_LABEL[chargingStatus]}
          </Badge>
          <span
            className={`text-theme-sm ${
              snapshot?.locked === false
                ? "font-medium text-warning-600 dark:text-warning-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {snapshot?.locked == null ? "잠금 —" : snapshot.locked ? "잠김" : "잠금 해제"}
          </span>
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
          <span
            className="ml-auto text-theme-xs text-gray-400"
            title={formatDateTime(dataFreshnessAt)}
          >
            데이터 {formatRelativeTime(dataFreshnessAt)}
            {vehicle.freshness.telemetrySource
              ? ` · ${vehicle.freshness.telemetrySource}`
              : ""}
          </span>
        </div>
        {asleepInferred && snapshot?.sleepInferredAt ? (
          <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            Telemetry 공백으로 취침을 추론했습니다 ·{" "}
            <span title={formatDateTime(snapshot.sleepInferredAt)}>
              {formatRelativeTime(snapshot.sleepInferredAt)}
            </span>
          </p>
        ) : null}
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
                  {isRetryingBaseline ? "Baseline 중..." : "Baseline 재시도"}
                </Button>
              ) : null}
              {guidance.actions.includes("reconnect_telemetry") ? (
                <Button
                  size="sm"
                  onClick={() => void handleReconnectTelemetry()}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? "재연결 중..." : "Telemetry 다시 연결"}
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
              <Badge color="warning">configSynced false</Badge>
              <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Telemetry 설정 동기화 미확인
              </h4>
            </div>
            <p className="mt-2 text-theme-sm text-gray-600 dark:text-gray-300">
              구독은 활성이지만 Tesla 쪽 fleet_telemetry_config synced 상태가 확인되지 않았습니다.
              스트림이 비거나 지연되면 「Telemetry 다시 연결」 또는 제원/Baseline 재시도를
              검토하세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleReconnectTelemetry()}
                disabled={isReconnecting}
              >
                {isReconnecting ? "재연결 중..." : "Telemetry 다시 연결"}
              </Button>
              <a href="#vehicle-ops">
                <Button size="sm" variant="outline">
                  운영 액션
                </Button>
              </a>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col items-center gap-6 xl:flex-row">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-brand-50 dark:border-gray-800 dark:bg-brand-500/10">
                <span className="text-2xl font-bold text-brand-500">
                  {vehicle.plateNumber.slice(0, 2)}
                </span>
              </div>
              <div className="text-center xl:text-left">
                <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {vehicle.plateNumber}
                </h4>
                <div className="flex flex-col items-center gap-2 xl:flex-row">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {vehicle.model} · {vehicle.year}
                  </p>
                  <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    VIN {vehicle.oemVehicleId ?? "-"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2 xl:justify-start">
                  <Badge color={vehicleStatusBadgeColor(status)}>
                    {asleepInferred ? "취침 (추론)" : STATUS_LABEL[status]}
                  </Badge>
                  {lifecycle === "READY" ? (
                    <Badge color="success">{LIFECYCLE_LABEL.READY}</Badge>
                  ) : shouldShowLifecycleBadge(lifecycle) && lifecycle ? (
                    <Badge color={lifecycleBadgeColor(lifecycle)}>
                      {LIFECYCLE_LABEL[lifecycle]}
                    </Badge>
                  ) : null}
                  {trimLabel ? <Badge color="light">{trimLabel}</Badge> : null}
                  {colorLabel ? <Badge color="light">{colorLabel}</Badge> : null}
                  <Badge color={chargingStatusBadgeColor(chargingStatus)}>
                    {CHARGING_STATUS_LABEL[chargingStatus]}
                  </Badge>
                </div>
                {status === "ASLEEP" && lifecycle === "READY" ? (
                  <p className="mt-2 text-theme-xs text-gray-400">
                    {asleepInferred
                      ? "관제 준비(READY)이며 취침은 Telemetry 공백으로 추론된 상태입니다. 서버가 차량을 깨우지 않습니다."
                      : "관제 준비(READY) 상태이며 현재 운행 상태는 취침(ASLEEP)입니다. 서버가 차량을 깨우지 않습니다."}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

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
                    {vehicle.model}
                    {colorLabel ? ` · ${colorLabel}` : ""}
                    {vehicle.oemVehicleId ? ` · ${vehicle.oemVehicleId.slice(-6)}` : ""}
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
                  Telemetry 연동 끊기
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleReconnectTelemetry()}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? "재연결 중..." : "Telemetry 다시 연결"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRetryBaseline()}
                disabled={isRetryingBaseline || lifecycle === "TELEMETRY_DISCONNECTED"}
              >
                {isRetryingBaseline ? "동기화 중..." : "제원 재동기화"}
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
                label="마지막 Telemetry"
                value={formatDateTime(vehicle.freshness.lastTelemetryAt)}
              />
              <InfoField
                label="마지막 REST"
                value={formatDateTime(vehicle.freshness.lastRestSyncAt)}
              />
              <InfoField label="REST 사유" value={restReasonLabel} />
              <InfoField
                label="소스"
                value={vehicle.freshness.telemetrySource ?? "-"}
              />
              <InfoField
                label="구독"
                value={
                  vehicle.telemetrySubscription
                    ? vehicle.telemetrySubscription.active
                      ? vehicle.telemetrySubscription.configSynced
                        ? "활성 · config synced"
                        : "활성 · config 미동기"
                      : vehicle.telemetrySubscription.disconnectReason
                        ? `단절 · ${DISCONNECT_REASON_LABEL[vehicle.telemetrySubscription.disconnectReason]}`
                        : "비활성"
                    : "-"
                }
              />
              <InfoField
                label="단절 시각"
                value={formatDateTime(vehicle.telemetrySubscription?.disconnectedAt ?? null)}
              />
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
                      저장된 Baseline/구독 오류가 없습니다.
                    </p>
                  ) : null}
                  {baselineLastError ? (
                    <div>
                      <p className="text-theme-xs font-medium text-gray-500">baselineLastError</p>
                      <p className="mt-1 break-all text-theme-sm text-gray-700 dark:text-gray-300">
                        {baselineLastError}
                      </p>
                      {vehicle.syncState?.baselineCompletedAt ? (
                        <p className="mt-1 text-theme-xs text-gray-400">
                          이후 Baseline 완료:{" "}
                          {formatRelativeTime(vehicle.syncState.baselineCompletedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {subscriptionLastError ? (
                    <div>
                      <p className="text-theme-xs font-medium text-gray-500">
                        subscription.lastError
                      </p>
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

        {/* B + C Situation / Location */}
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

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              현재 위치
            </h4>
            {mapVehicle.length > 0 ? (
              <>
                <VehicleMap
                  vehicles={mapVehicle}
                  selectedId={vehicle.id}
                  height={280}
                  centerOnSelected
                />
                <p className="mt-2 text-theme-xs text-gray-400">
                  {formatLocationSummary(snapshot?.latitude, snapshot?.longitude)}
                </p>
              </>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center dark:border-gray-700 dark:bg-white/[0.02]">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  위치 데이터 없음
                </p>
                <p className="mt-2 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
                  위도·경도가 없어 지도를 표시하지 않습니다. 추정 좌표는 사용하지 않습니다.
                  Telemetry에 Location이 구독되어 있으며, 취침·공백 시 null이 유지됩니다. 깨어난 뒤
                  스트림 또는 Baseline으로 갱신하세요.
                </p>
                {asleepInferred ? (
                  <p className="mt-3 text-theme-xs text-gray-400">
                    현재 상태: 취침(추론) · 깨어난 뒤 Location 수신을 확인하세요.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* D Security + Climate */}
        <div className="grid gap-6 xl:grid-cols-2">
          <div
            id="vehicle-security"
            className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                잠금 · 개폐
              </h4>
              {issueTags.length > 0 ? (
                <span className="text-theme-xs text-gray-500">
                  요약 이슈 {issueTags.length}건 (상세는 아래·이벤트)
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
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

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              공조 · 온도
            </h4>
            <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
              출처 힌트: {climateSourceHint}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                label="공조"
                value={snapshot?.climateOn == null ? "-" : snapshot.climateOn ? "ON" : "OFF"}
              />
              <InfoField label="실내" value={formatTempC(snapshot?.insideTempC ?? null)} />
              <InfoField label="실외" value={formatTempC(snapshot?.outsideTempC ?? null)} />
            </div>
          </div>
        </div>

        {tpms ? (
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">TPMS</h4>
            <p
              className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400"
              title={formatDateTime(tpmsSourceAt)}
            >
              출처 힌트: {tpmsSourceHint}. Telemetry 기본 구독에 없어 REST Baseline 이후 값이 유지될 수
              있습니다.
            </p>
            <TpmsDiagram
              frontLeft={tpms.fl}
              frontRight={tpms.fr}
              rearLeft={tpms.rl}
              rearRight={tpms.rr}
            />
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            인근 충전소
          </h4>
          <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
            Baseline / wake REST 시 `nearby_charging_sites`로 갱신됩니다. 차량이 취침이면 비어 있을 수
            있습니다.
          </p>
          {snapshot?.nearbyChargingSites && snapshot.nearbyChargingSites.length > 0 ? (
            <ul className="space-y-2">
              {snapshot.nearbyChargingSites.map((site) => (
                <li
                  key={`${site.name}-${site.distanceKm}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
                >
                  <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    {site.name}
                  </span>
                  <span className="text-theme-xs text-gray-500">
                    {site.distanceKm.toLocaleString("ko-KR")} km
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 dark:border-gray-700">
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                표시할 인근 충전소가 없습니다.
              </p>
              <p className="mt-1 text-theme-xs text-gray-400">
                차량이 깨어 있을 때 「제원 재동기화」(Baseline)를 실행하면 갱신됩니다.
              </p>
            </div>
          )}
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
          Telemetry 연동 끊기
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          이 차량의 <strong>실시간 Telemetry 수신이 중지</strong>됩니다. Virtual Key는 자동
          삭제되지 않습니다. 과금·프라이버시 목적의 구독 해지에 가깝습니다.
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
            {isDisconnecting ? "해제 중..." : "연동 끊기"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={successDisconnectOpen}
        onClose={() => setSuccessDisconnectOpen(false)}
        className="max-w-lg p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          Telemetry 연동 해제 완료
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          보리차 FMS와의 Telemetry 연동이 해제되었습니다. 완벽한 보안을 위해 Tesla 모바일 앱
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
          목록에서 이 차량이 제거되며 Telemetry 구독도 해제됩니다. Virtual Key는 자동 삭제되지
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
