"use client";

import Link from "next/link";
import { useState } from "react";

import { BatteryHealthGauge } from "@/components/fleet/battery-health-gauge";
import { TpmsDiagram } from "@/components/fleet/tpms-diagram";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import Badge from "@/components/ui/badge/Badge";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useVehicleDetail, useVehicleRefresh } from "@/hooks/use-vehicles";
import {
  chargingStatusBadgeColor,
  providerLabel,
  vehicleStatusBadgeColor,
} from "@/lib/fms-badge-utils";
import type { MapVehicle, VehicleDetailDto } from "@/lib/types/vehicle";
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
  const { data, isLoading, isError, error, isFetching } = useVehicleDetail(vehicleId);
  const refreshVehicles = useVehicleRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
    } finally {
      setIsRefreshing(false);
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
                  <Badge color={chargingStatusBadgeColor(chargingStatus)}>
                    {CHARGING_STATUS_LABEL[chargingStatus]}
                  </Badge>
                  {issueTags.map((tag) => (
                    <Badge key={tag.label} color={tag.color}>
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>
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
    </>
  );
}
