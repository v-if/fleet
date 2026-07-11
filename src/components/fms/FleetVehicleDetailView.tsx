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
  formatTempC,
  isLowTpms,
} from "@/lib/vehicle-status";

type FleetVehicleDetailViewProps = {
  vehicleId: string;
};

type IssueTagItem = {
  label: string;
  color: "warning" | "error" | "info";
};

const ATM_TO_PSI = 14.7;

function convertTeslaTpmsToPsi(value: number | null, provider: string) {
  if (value == null) return null;
  if (provider !== "tesla") return value;
  return value * ATM_TO_PSI;
}

function collectIssueTags(vehicle: VehicleDetailDto): IssueTagItem[] {
  const snapshot = vehicle.snapshot;
  const tags: IssueTagItem[] = [];

  if (!snapshot) return tags;

  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    tags.push({ label: "배터리 20% 미만", color: "error" });
  }
  if (!snapshot.locked) tags.push({ label: "잠금 해제", color: "warning" });
  if (snapshot.doorsOpen) tags.push({ label: "문 개방", color: "warning" });
  if (snapshot.windowsOpen) tags.push({ label: "창문 개방", color: "warning" });
  if (snapshot.sentryMode) tags.push({ label: "센트리 모드", color: "info" });
  if (isLowTpms(snapshot.tpmsFrontLeft)) tags.push({ label: "TPMS 전좌 이상", color: "error" });
  if (isLowTpms(snapshot.tpmsFrontRight)) tags.push({ label: "TPMS 전우 이상", color: "error" });
  if (isLowTpms(snapshot.tpmsRearLeft)) tags.push({ label: "TPMS 후좌 이상", color: "error" });
  if (isLowTpms(snapshot.tpmsRearRight)) tags.push({ label: "TPMS 후우 이상", color: "error" });

  for (const event of vehicle.events.slice(0, 3)) {
    tags.push({
      label: event.message,
      color: event.type === "ALERT" ? "error" : "warning",
    });
  }

  const unique = new Map<string, IssueTagItem>();
  for (const tag of tags) unique.set(tag.label, tag);
  return Array.from(unique.values());
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
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
  const issueTags = collectIssueTags(vehicle);
  const lifecycle = vehicle.syncState?.lifecycle ?? null;
  const guidance = lifecycleGuidance(lifecycle);
  const trimLabel = labelTrimBadging(vehicle.trimBadging);
  const colorLabel = formatColorBadge(vehicle);
  const carTypeLabel = labelCarType(vehicle.carType);

  const mapVehicle: MapVehicle[] =
    snapshot?.status != null && snapshot.latitude != null && snapshot.longitude != null
      ? [
          {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            status: snapshot.status,
            latitude: snapshot.latitude,
            longitude: snapshot.longitude,
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

      <div className="mb-6 flex flex-wrap gap-2">
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
                  <Badge color={vehicleStatusBadgeColor(status)}>{STATUS_LABEL[status]}</Badge>
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
                  {issueTags.map((tag) => (
                    <Badge key={tag.label} color={tag.color}>
                      {tag.label}
                    </Badge>
                  ))}
                </div>
                {status === "ASLEEP" && lifecycle === "READY" ? (
                  <p className="mt-2 text-theme-xs text-gray-400">
                    관제 준비(READY) 상태이며 현재 운행 상태는 취침(ASLEEP)입니다. 서버가 차량을
                    깨우지 않습니다.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">제원</h4>
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
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField label="표시 모델" value={vehicle.model} />
              <InfoField label="연식" value={String(vehicle.year)} />
              <InfoField label="VIN" value={vehicle.oemVehicleId ?? "-"} />
              <InfoField label="car_type" value={carTypeLabel ?? vehicle.carType ?? "-"} />
              <InfoField label="트림" value={trimLabel ?? vehicle.trimBadging ?? "-"} />
              <InfoField label="외장색" value={colorLabel ?? "-"} />
              <InfoField label="Tesla 표시명" value={vehicle.teslaDisplayName ?? "-"} />
              <InfoField
                label="제원 동기화"
                value={formatDateTime(vehicle.specsSyncedAt)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              데이터 신선도
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                label="마지막 Telemetry"
                value={formatDateTime(vehicle.freshness.lastTelemetryAt)}
              />
              <InfoField
                label="마지막 REST"
                value={formatDateTime(vehicle.freshness.lastRestSyncAt)}
              />
              <InfoField
                label="REST 사유"
                value={vehicle.freshness.lastRestSyncReason ?? "-"}
              />
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
                        : "활성"
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
              <InfoField
                label="Baseline"
                value={
                  vehicle.syncState?.baselineCompletedAt
                    ? formatDateTime(vehicle.syncState.baselineCompletedAt)
                    : vehicle.syncState?.baselineLastError
                      ? `실패: ${vehicle.syncState.baselineLastError}`
                      : "-"
                }
              />
            </div>
          </div>
        </div>

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
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              현재 위치
            </h4>
            {mapVehicle.length > 0 ? (
              <VehicleMap
                vehicles={mapVehicle}
                selectedId={vehicle.id}
                height={280}
                centerOnSelected
              />
            ) : (
              <p className="text-theme-sm text-gray-500">위치 정보가 없습니다.</p>
            )}
            {snapshot ? (
              <p className="mt-2 text-theme-xs text-gray-400">
                {formatLocationSummary(snapshot.latitude, snapshot.longitude)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              잠금 · 개폐
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                label="잠금"
                value={snapshot?.locked == null ? "-" : snapshot.locked ? "잠김" : "해제"}
              />
              <InfoField
                label="문"
                value={snapshot?.doorsOpen == null ? "-" : snapshot.doorsOpen ? "개방" : "닫힘"}
              />
              <InfoField
                label="창문"
                value={
                  snapshot?.windowsOpen == null ? "-" : snapshot.windowsOpen ? "개방" : "닫힘"
                }
              />
              <InfoField
                label="센트리"
                value={snapshot?.sentryMode == null ? "-" : snapshot.sentryMode ? "활성" : "비활성"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              공조 · 온도
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                label="공조"
                value={snapshot?.climateOn == null ? "-" : snapshot.climateOn ? "ON" : "OFF"}
              />
              <InfoField label="실내" value={formatTempC(snapshot?.insideTempC ?? null)} />
              <InfoField label="실외" value={formatTempC(snapshot?.outsideTempC ?? null)} />
              <InfoField label="SW 버전" value={snapshot?.softwareVersion ?? "-"} />
            </div>
          </div>
        </div>

        {tpms ? (
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">TPMS</h4>
            <TpmsDiagram
              frontLeft={tpms.fl}
              frontRight={tpms.fr}
              rearLeft={tpms.rl}
              rearRight={tpms.rr}
            />
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            최근 이벤트
          </h4>
          <ul className="space-y-3">
            {vehicle.events.slice(0, 8).map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
              >
                <div>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    {event.message}
                  </p>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </div>
                <Badge color={event.type === "ALERT" ? "error" : "warning"} size="sm">
                  {event.type}
                </Badge>
              </li>
            ))}
          </ul>
          {vehicle.events.length === 0 ? (
            <p className="text-theme-sm text-gray-500">등록된 이벤트가 없습니다.</p>
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
