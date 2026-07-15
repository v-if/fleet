import type { ChargingStatus } from "@prisma/client";

import { BatteryProgressBar } from "@/components/fms/BatteryProgressBar";
import { labelChargingPowerKind } from "@/lib/tesla/charging-power";

type ChargingSessionCardProps = {
  chargingStatus: Exclude<ChargingStatus, "DISCONNECTED">;
  batteryPercent: number | null | undefined;
  rangeKm: number | null | undefined;
  chargerPowerKw: number | null | undefined;
  chargeLimitSoc: number | null | undefined;
  chargingPowerKind?: string | null;
  /** CAF: hours until full / ready */
  timeToFullChargeHours?: number | null;
  chargeAmps?: number | null;
  chargePortDoorOpen?: boolean | null;
  fastChargerPresent?: boolean | null;
  detailedChargeState?: string | null;
};

const TITLE: Record<Exclude<ChargingStatus, "DISCONNECTED">, string> = {
  CHARGING: "충전 중",
  COMPLETE: "충전 완료",
  STOPPED: "충전 중지",
};

function toneClass(status: Exclude<ChargingStatus, "DISCONNECTED">) {
  switch (status) {
    case "CHARGING":
      return "border-success-200 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10";
    case "COMPLETE":
      return "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10";
    case "STOPPED":
      return "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10";
  }
}

function formatEtaHours(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `약 ${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
}

/** 「실시간 차량 정보」내 충전 세션 서브카드 (CC + CAF) */
export function ChargingSessionCard({
  chargingStatus,
  batteryPercent,
  rangeKm,
  chargerPowerKw,
  chargeLimitSoc,
  chargingPowerKind,
  timeToFullChargeHours,
  chargeAmps,
  chargePortDoorOpen,
  fastChargerPresent,
  detailedChargeState,
}: ChargingSessionCardProps) {
  const kindLabel = labelChargingPowerKind(chargingPowerKind);
  const rangeLabel =
    rangeKm != null && Number.isFinite(rangeKm)
      ? `주행 가능 ${Math.round(rangeKm).toLocaleString("ko-KR")} km`
      : null;
  const powerLabel =
    chargerPowerKw != null && Number.isFinite(chargerPowerKw)
      ? `출력 ${chargerPowerKw.toLocaleString("ko-KR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 0,
        })} kW`
      : null;
  const limitLabel =
    chargeLimitSoc != null && Number.isFinite(chargeLimitSoc)
      ? `한도 ${Math.round(chargeLimitSoc)}%`
      : null;
  const etaLabel = formatEtaHours(timeToFullChargeHours);
  const ampsLabel =
    chargeAmps != null && Number.isFinite(chargeAmps)
      ? `${chargeAmps.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} A`
      : null;
  const portLabel =
    chargePortDoorOpen === true
      ? "충전구 열림"
      : chargePortDoorOpen === false
        ? "충전구 닫힘"
        : null;
  const fastLabel = fastChargerPresent === true ? "급속 충전기" : null;

  const showSocRow = batteryPercent != null || rangeLabel != null;
  const showPowerRow =
    powerLabel != null ||
    limitLabel != null ||
    etaLabel != null ||
    ampsLabel != null ||
    portLabel != null ||
    fastLabel != null;

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 sm:px-5 ${toneClass(chargingStatus)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
          {TITLE[chargingStatus]}
        </p>
        {kindLabel ? (
          <span className="rounded-md border border-gray-300/80 bg-white/60 px-1.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-white/5 dark:text-gray-300">
            {kindLabel}
          </span>
        ) : null}
        {detailedChargeState ? (
          <span
            className="truncate text-theme-xs text-gray-500 dark:text-gray-400"
            title={detailedChargeState}
          >
            {detailedChargeState.replace(/^DetailedChargeState/i, "")}
          </span>
        ) : null}
      </div>
      {showSocRow ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
          {batteryPercent != null ? (
            <div className="min-w-[8rem] max-w-[12rem] flex-1 sm:flex-none">
              <BatteryProgressBar percent={batteryPercent} />
            </div>
          ) : null}
          {rangeLabel ? (
            <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              {rangeLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {showPowerRow ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-theme-sm text-gray-700 dark:text-gray-300">
          {powerLabel ? <span>{powerLabel}</span> : null}
          {ampsLabel ? <span>{ampsLabel}</span> : null}
          {limitLabel ? <span>{limitLabel}</span> : null}
          {etaLabel ? <span>완료 예정 {etaLabel}</span> : null}
          {portLabel ? <span>{portLabel}</span> : null}
          {fastLabel ? <span>{fastLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function shouldShowChargingSessionCard(
  status: ChargingStatus | null | undefined,
): status is Exclude<ChargingStatus, "DISCONNECTED"> {
  return status === "CHARGING" || status === "COMPLETE" || status === "STOPPED";
}
