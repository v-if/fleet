"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { TpmsDiagram } from "@/components/fleet/tpms-diagram";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import { BatteryProgressBar } from "@/components/fms/BatteryProgressBar";
import {
  ChargingSessionCard,
  shouldShowChargingSessionCard,
} from "@/components/fms/ChargingSessionCard";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useVehicleDetail, useVehicleRefresh } from "@/hooks/use-vehicles";
import { CheckLineIcon, CloseLineIcon } from "@/icons";
import { labelNearbyChargingSource } from "@/lib/tesla/nearby-charging";
import type { MapVehicle } from "@/lib/types/vehicle";
import {
  buildOpsSummary,
  convertTeslaTpmsToPsi,
  nearbySiteLabel,
  nearbySiteTypeBadgeLabel,
  nearbySiteTypeColor,
  OPS_MODE_LABEL,
  opsModeBadgeColor,
  resolveVehicleOpsMode,
  shouldShowDrivingTripCard,
} from "@/lib/vehicle-detail-v3";
import {
  formatColorBadge,
  LIFECYCLE_LABEL,
  lifecycleBadgeColor,
  lifecycleGuidance,
  shouldShowLifecycleBadge,
} from "@/lib/vehicle-lifecycle";
import {
  formatDateTime,
  formatOdometer,
  formatRelativeTime,
  formatTempC,
  hasValidCoordinates,
} from "@/lib/vehicle-status";

type Props = { vehicleId: string };

export function FleetVehicleDetailViewV3({ vehicleId }: Props) {
  const { data, isLoading, isError, isFetching, refetch } = useVehicleDetail(vehicleId);
  const refreshVehicles = useVehicleRefresh();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRetryingBaseline, setIsRetryingBaseline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [specsModalOpen, setSpecsModalOpen] = useState(false);
  const [vinCopied, setVinCopied] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingDisplayName) {
      displayNameInputRef.current?.focus();
      displayNameInputRef.current?.select();
    }
  }, [isEditingDisplayName]);

  function startEditDisplayName(currentName: string) {
    setDisplayNameDraft(currentName);
    setDisplayNameError(null);
    setIsEditingDisplayName(true);
  }

  function cancelEditDisplayName() {
    setIsEditingDisplayName(false);
    setDisplayNameDraft("");
    setDisplayNameError(null);
  }

  async function saveDisplayName() {
    setIsSavingDisplayName(true);
    setDisplayNameError(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: displayNameDraft }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setDisplayNameError(body.error ?? "표시명 저장에 실패했습니다.");
        return;
      }
      setIsEditingDisplayName(false);
      setDisplayNameDraft("");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setDisplayNameError("표시명 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingDisplayName(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRetryBaseline() {
    setIsRetryingBaseline(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/baseline`, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionMessage(
          body.error
            ? `제원 불러오기 실패: ${body.error}`
            : "제원 불러오기에 실패했습니다. 차량이 깨어 있을 때 다시 시도하세요.",
        );
        return;
      }
      setActionMessage("제원을 다시 불러왔습니다. (배터리·위치는 변경되지 않습니다.)");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("제원 요청 중 오류가 발생했습니다.");
    } finally {
      setIsRetryingBaseline(false);
    }
  }

  async function handleReconnect() {
    setIsReconnecting(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/telemetry/reconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionMessage(body.error ?? "실시간 연동 다시 켜기에 실패했습니다.");
        return;
      }
      setActionMessage("실시간 연동을 다시 켰습니다. 차량 신호를 기다려 주세요.");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await refetch();
    } catch {
      setActionMessage("연동 요청 중 오류가 발생했습니다.");
    } finally {
      setIsReconnecting(false);
    }
  }

  if (isLoading) {
    return <p className="p-6 text-theme-sm text-gray-500">불러오는 중...</p>;
  }
  if (isError || !data?.vehicle) {
    return (
      <div className="p-6">
        <p className="text-theme-sm text-error-600">차량을 불러오지 못했습니다.</p>
        <Link href="/vehicles" className="mt-4 inline-block text-theme-sm underline">
          목록으로
        </Link>
      </div>
    );
  }

  const vehicle = data.vehicle;
  const snapshot = vehicle.snapshot;
  const mode = resolveVehicleOpsMode(snapshot);
  const summary = buildOpsSummary(vehicle, data.provider);
  const lifecycle = vehicle.syncState?.lifecycle ?? null;
  const guidance = lifecycleGuidance(lifecycle);
  const hasCoords = hasValidCoordinates(snapshot?.latitude, snapshot?.longitude);
  const mapVehicle: MapVehicle[] = hasCoords
    ? [
        {
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          model: vehicle.model,
          status: snapshot?.status ?? null,
          latitude: snapshot!.latitude!,
          longitude: snapshot!.longitude!,
          batteryPercent: snapshot?.batteryPercent ?? null,
          ignitionOn: snapshot?.ignitionOn ?? null,
          chargingStatus: snapshot?.chargingStatus ?? null,
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
  const showTpms = Boolean(
    tpms && (tpms.fl != null || tpms.fr != null || tpms.rl != null || tpms.rr != null),
  );
  const tpmsValues = [tpms?.fl, tpms?.fr, tpms?.rl, tpms?.rr].filter(
    (v): v is number => v != null,
  );
  const tpmsAvg =
    tpmsValues.length > 0
      ? Math.round((tpmsValues.reduce((a, b) => a + b, 0) / tpmsValues.length) * 10) / 10
      : null;
  const nearbySites = snapshot?.nearbyChargingSites ?? [];
  const displayedNearbySites = nearbySites.slice(0, 5);
  const mapNearbySites = displayedNearbySites.flatMap((site, index) => {
    if (site.latitude == null || site.longitude == null) return [];
    return [
      {
        id: `nearby-${index}-${site.name}`,
        name: site.name,
        latitude: site.latitude,
        longitude: site.longitude,
        distanceKm: site.distanceKm,
        siteType: site.siteType,
        label: nearbySiteLabel(index),
      },
    ];
  });
  const showTrip = shouldShowDrivingTripCard(mode, snapshot);
  const showCharging = shouldShowChargingSessionCard(snapshot?.chargingStatus);
  const dataFreshnessAt =
    vehicle.freshness.lastTelemetryAt ?? snapshot?.lastUpdatedAt ?? null;
  const showSignalWarning =
    Boolean(vehicle.telemetrySubscription?.active) &&
    !vehicle.telemetrySubscription?.configSynced &&
    !vehicle.freshness.lastTelemetryAt &&
    !vehicle.syncState?.telemetryConfigSyncedAt;

  const milesKm =
    snapshot?.milesToArrival != null
      ? Math.round(snapshot.milesToArrival * 1.60934 * 10) / 10
      : null;

  return (
    <>
      <FleetToolbar
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
        layout="inline"
        actions={
          <Link
            href="/vehicles"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
          >
            목록으로
          </Link>
        }
      />

      {actionMessage ? (
        <p className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
          {actionMessage}
        </p>
      ) : null}

      {showSignalWarning ? (
        <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-500/30 dark:bg-warning-500/10">
          <p className="text-theme-sm text-warning-800 dark:text-warning-200">
            실시간 연동은 켜져 있지만 차량 신호가 아직 없습니다. SoC·위치 등을 받으려면 「실시간
            연동 다시 켜기」로 구독을 재등록하세요.
          </p>
          <Button
            size="sm"
            className="mt-2"
            disabled={isReconnecting}
            onClick={() => void handleReconnect()}
          >
            {isReconnecting ? "처리 중..." : "실시간 연동 다시 켜기"}
          </Button>
        </div>
      ) : null}

      {lifecycle && shouldShowLifecycleBadge(lifecycle) ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge color={lifecycleBadgeColor(lifecycle)}>{LIFECYCLE_LABEL[lifecycle]}</Badge>
          {guidance?.body ? (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">{guidance.body}</p>
          ) : null}
        </div>
      ) : null}

      {/* Hero + Map */}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge color={opsModeBadgeColor(mode)}>{OPS_MODE_LABEL[mode]}</Badge>
            {snapshot?.shiftState ? (
              <span className="text-theme-xs text-gray-500">변속 {snapshot.shiftState}</span>
            ) : null}
            {dataFreshnessAt ? (
              <span
                className="ml-auto text-theme-xs text-gray-400"
                title={formatDateTime(dataFreshnessAt)}
              >
                데이터 {formatRelativeTime(dataFreshnessAt)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isEditingDisplayName ? (
              <>
                <input
                  ref={displayNameInputRef}
                  type="text"
                  value={displayNameDraft}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveDisplayName();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEditDisplayName();
                    }
                  }}
                  disabled={isSavingDisplayName}
                  maxLength={32}
                  aria-label="차량 표시명"
                  className="min-w-[10rem] max-w-full flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-lg font-semibold text-gray-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white/90"
                />
                <button
                  type="button"
                  onClick={() => void saveDisplayName()}
                  disabled={isSavingDisplayName}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:border-success-400 hover:text-success-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-success-500 dark:hover:text-success-400"
                  aria-label="표시명 저장"
                  title="저장"
                >
                  <CheckLineIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelEditDisplayName}
                  disabled={isSavingDisplayName}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:border-error-400 hover:text-error-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-error-500 dark:hover:text-error-400"
                  aria-label="표시명 취소"
                  title="취소"
                >
                  <CloseLineIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {vehicle.plateNumber}
                </h4>
                <button
                  type="button"
                  onClick={() => startEditDisplayName(vehicle.plateNumber)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-theme-xs font-semibold text-gray-500 transition hover:border-brand-400 hover:text-brand-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
                  aria-label="표시명 수정"
                  title="표시명 수정"
                >
                  <span aria-hidden="true">✏</span>
                  <span className="sr-only">표시명 수정</span>
                </button>
              </>
            )}
          </div>
          {displayNameError ? (
            <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">
              {displayNameError}
            </p>
          ) : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-theme-sm text-gray-500">
              {vehicle.model}
              {formatColorBadge(vehicle) ? ` · ${formatColorBadge(vehicle)}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setSpecsModalOpen(true)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-theme-xs font-semibold text-gray-500 transition hover:border-brand-400 hover:text-brand-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
              aria-label="제원 보기"
              title="제원 보기"
            >
              <span aria-hidden="true">i</span>
              <span className="sr-only">제원 보기</span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[8rem] max-w-[12rem] flex-1">
              <BatteryProgressBar percent={snapshot?.batteryPercent ?? null} />
            </div>
            {snapshot?.rangeKm != null ? (
              <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(snapshot.rangeKm).toLocaleString("ko-KR")} km
              </span>
            ) : null}
            {snapshot?.odometerKm != null ? (
              <span className="text-theme-xs text-gray-400">
                누적 {formatOdometer(snapshot.odometerKm)}
              </span>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
            <h5 className="mb-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              관제 요약
            </h5>
            <ul className="space-y-1.5">
              {summary.map((item) => (
                <li
                  key={item.text}
                  className={
                    item.tone === "warn"
                      ? "text-theme-sm text-warning-700 dark:text-warning-300"
                      : item.tone === "info"
                        ? "text-theme-sm text-brand-700 dark:text-brand-300"
                        : "text-theme-sm text-gray-700 dark:text-gray-300"
                  }
                >
                  {item.tone === "warn" ? "⚠ " : item.tone === "ok" ? "✓ " : "· "}
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          {showCharging && snapshot?.chargingStatus && snapshot.chargingStatus !== "DISCONNECTED" ? (
            <div className="mt-4">
              <ChargingSessionCard
                chargingStatus={snapshot.chargingStatus}
                batteryPercent={snapshot.batteryPercent}
                rangeKm={snapshot.rangeKm}
                chargerPowerKw={snapshot.chargerPowerKw}
                chargeLimitSoc={snapshot.chargeLimitSoc}
                chargingPowerKind={snapshot.chargingPowerKind}
                timeToFullChargeHours={snapshot.timeToFullChargeHours}
                chargeAmps={snapshot.chargeAmps}
                chargePortDoorOpen={snapshot.chargePortDoorOpen}
                fastChargerPresent={snapshot.fastChargerPresent}
                detailedChargeState={snapshot.detailedChargeState}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">위치</h4>
          {hasCoords ? (
            <div className="h-64 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
              <VehicleMap
                vehicles={mapVehicle}
                selectedId={vehicle.id}
                hideSelectionCard
                height={256}
                nearbySites={mapNearbySites}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center text-theme-sm text-gray-500 dark:border-gray-700">
              위치 신호가 없습니다.
            </p>
          )}

          {nearbySites.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h5 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                  인근 충전소
                </h5>
                {snapshot?.nearbyChargingMeta?.capturedAt ||
                snapshot?.nearbyChargingMeta?.source ? (
                  <p className="text-theme-xs text-gray-500">
                    {[
                      labelNearbyChargingSource(snapshot.nearbyChargingMeta?.source),
                      snapshot.nearbyChargingMeta?.capturedAt
                        ? `수집 ${formatRelativeTime(snapshot.nearbyChargingMeta.capturedAt)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <ul className="space-y-2">
                {displayedNearbySites.map((site, index) => {
                  const label = nearbySiteLabel(index);
                  const badgeColor = nearbySiteTypeColor(site.siteType);
                  const typeBadge = nearbySiteTypeBadgeLabel(site.siteType);

                  return (
                    <li
                      key={`${label}-${site.name}-${site.distanceKm}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                          style={{ backgroundColor: badgeColor }}
                          aria-hidden
                        >
                          {label}
                        </span>
                        {typeBadge ? (
                          <span
                            className="inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-bold leading-none"
                            style={{
                              color: badgeColor,
                              border: `1px solid ${badgeColor}`,
                              backgroundColor: `${badgeColor}14`,
                            }}
                            aria-label={
                              typeBadge === "SC" ? "슈퍼차저" : "데스티네이션 충전소"
                            }
                          >
                            {typeBadge}
                          </span>
                        ) : null}
                        <span className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {site.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-theme-xs text-gray-500">
                        {site.distanceKm.toLocaleString("ko-KR")} km
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-theme-xs text-gray-500">
                `SC`는 슈퍼차저, `DC`는 데스티네이션 충전소를 뜻합니다.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {/* Driving trip — CAF */}
      {showTrip && snapshot ? (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
            주행 · 목적지
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.vehicleSpeedKmh != null ? (
              <Metric label="속도" value={`${Math.round(snapshot.vehicleSpeedKmh)} km/h`} />
            ) : null}
            {snapshot.destinationName ? (
              <Metric label="목적지" value={snapshot.destinationName} />
            ) : null}
            {snapshot.minutesToArrival != null ? (
              <Metric
                label="도착까지"
                value={`약 ${Math.round(snapshot.minutesToArrival)}분`}
              />
            ) : null}
            {milesKm != null ? <Metric label="남은 거리" value={`${milesKm} km`} /> : null}
            {snapshot.expectedEnergyPercentAtArrival != null ? (
              <Metric
                label="도착 시 예상 SoC"
                value={`${Math.round(snapshot.expectedEnergyPercentAtArrival)}%`}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Security · climate · TPMS */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
            보안 · 공조
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile
              label="잠금"
              value={
                snapshot?.locked == null ? "—" : snapshot.locked ? "잠김" : "해제"
              }
              warn={snapshot?.locked === false}
            />
            <Tile
              label="감시모드"
              value={
                snapshot?.sentryMode == null
                  ? "—"
                  : snapshot.sentryMode
                    ? "ON"
                    : "OFF"
              }
            />
            <Tile
              label="공조"
              value={
                snapshot?.climateOn == null ? "—" : snapshot.climateOn ? "ON" : "OFF"
              }
            />
            <Tile label="실내" value={formatTempC(snapshot?.insideTempC) ?? "—"} />
            <Tile label="실외" value={formatTempC(snapshot?.outsideTempC) ?? "—"} />
            <Tile
              label="프리컨디션"
              value={
                snapshot?.preconditioningEnabled == null
                  ? "—"
                  : snapshot.preconditioningEnabled
                    ? "ON"
                    : "OFF"
              }
            />
          </div>
          {(snapshot?.doorsOpen ||
            snapshot?.windowsOpen ||
            snapshot?.frontTrunkOpen ||
            snapshot?.rearTrunkOpen) && (
            <p className="mt-3 text-theme-xs text-warning-700 dark:text-warning-300">
              {[
                snapshot.doorsOpen ? "문 열림" : null,
                snapshot.windowsOpen ? "창문 열림" : null,
                snapshot.frontTrunkOpen ? "프렁크 열림" : null,
                snapshot.rearTrunkOpen ? "트렁크 열림" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">타이어</h4>
          {showTpms && tpms ? (
            <>
              <TpmsDiagram
                frontLeft={tpms.fl}
                frontRight={tpms.fr}
                rearLeft={tpms.rl}
                rearRight={tpms.rr}
              />
              <div className="mt-3 flex flex-wrap gap-3 text-theme-xs text-gray-500">
                {tpmsAvg != null ? <span>평균 {tpmsAvg} PSI</span> : null}
                {snapshot?.tpmsHardWarnings ? (
                  <span className="text-error-600">Hard: {snapshot.tpmsHardWarnings}</span>
                ) : (
                  <span>Hard 경고 없음</span>
                )}
                {snapshot?.tpmsSoftWarnings ? (
                  <span className="text-warning-600">Soft: {snapshot.tpmsSoftWarnings}</span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-theme-sm text-gray-400">타이어 압력 신호 없음</p>
          )}
        </section>
      </div>

      {/* OTA when progressing */}
      {snapshot &&
      ((snapshot.softwareUpdateDownloadPercent != null &&
        snapshot.softwareUpdateDownloadPercent > 0) ||
        (snapshot.softwareUpdateInstallPercent != null &&
          snapshot.softwareUpdateInstallPercent > 0) ||
        snapshot.softwareUpdateVersion) ? (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">OTA</h4>
          <div className="flex flex-wrap gap-3 text-theme-sm text-gray-700 dark:text-gray-300">
            {snapshot.softwareUpdateVersion ? (
              <span>버전 {snapshot.softwareUpdateVersion}</span>
            ) : null}
            {snapshot.softwareUpdateDownloadPercent != null ? (
              <span>다운로드 {Math.round(snapshot.softwareUpdateDownloadPercent)}%</span>
            ) : null}
            {snapshot.softwareUpdateInstallPercent != null ? (
              <span>설치 {Math.round(snapshot.softwareUpdateInstallPercent)}%</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Ops */}
      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">운영</h4>
        <p className="mb-3 text-theme-xs text-gray-500">
          「제원 다시 불러오기」는 모델·색·SW 등 고정 제원만 가져옵니다. 배터리·위치는 Telemetry입니다.
          제원 내용은 Hero 모델명 옆 <strong>i</strong>에서 볼 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isReconnecting}
            onClick={() => void handleReconnect()}
          >
            {isReconnecting ? "처리 중..." : "실시간 연동 다시 켜기"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isRetryingBaseline}
            onClick={() => void handleRetryBaseline()}
          >
            {isRetryingBaseline ? "불러오는 중..." : "제원 다시 불러오기"}
          </Button>
        </div>
      </section>

      <Modal
        isOpen={specsModalOpen}
        onClose={() => {
          setSpecsModalOpen(false);
          setVinCopied(false);
        }}
        className="mx-4 max-h-[85vh] max-w-lg overflow-y-auto p-5 sm:p-6"
      >
        <h3 className="mb-1 pr-10 text-lg font-semibold text-gray-800 dark:text-white/90">
          제원
        </h3>
        <p className="mb-4 text-theme-xs text-gray-500">
          {vehicle.plateNumber}
          {!vehicle.specsSyncedAt && !vehicle.wheelType && !vehicle.chargePortType
            ? " · 값이 비어 있으면 운영에서 「제원 다시 불러오기」를 사용하세요."
            : ""}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="모델" value={vehicle.model || "—"} />
          <Metric label="연식" value={vehicle.year ? String(vehicle.year) : "—"} />
          <Metric label="색상" value={formatColorBadge(vehicle) ?? "—"} />
          <Metric label="휠" value={vehicle.wheelType?.trim() || "—"} />
          <Metric label="루프" value={vehicle.roofColor?.trim() || "—"} />
          <Metric label="충전 포트" value={vehicle.chargePortType?.trim() || "—"} />
          <Metric
            label="Autopilot HW"
            value={vehicle.driverAssist?.trim() || "—"}
          />
          <div className="rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800 sm:col-span-2">
            <p className="text-theme-xs text-gray-500">VIN</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="break-all text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {vehicle.oemVehicleId ?? "—"}
              </p>
              {vehicle.oemVehicleId ? (
                <button
                  type="button"
                  className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(vehicle.oemVehicleId!);
                      setVinCopied(true);
                      window.setTimeout(() => setVinCopied(false), 1500);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {vinCopied ? "복사됨" : "복사"}
                </button>
              ) : null}
            </div>
          </div>
          <Metric
            label="소프트웨어"
            value={vehicle.firmwareVersion ?? snapshot?.softwareVersion ?? "—"}
          />
          <Metric
            label="제원 동기화"
            value={
              vehicle.specsSyncedAt ? formatRelativeTime(vehicle.specsSyncedAt) : "—"
            }
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setSpecsModalOpen(false)}>
            닫기
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <p className="text-theme-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-theme-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function Tile({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        warn
          ? "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10"
          : "border-gray-100 dark:border-gray-800"
      }`}
    >
      <p className="text-theme-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-theme-sm font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
