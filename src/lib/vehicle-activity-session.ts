import type {
  ActivitySessionKind,
  ActivitySessionSource,
  ChargingStatus,
  VehicleActivitySession,
  VehicleStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeShiftState } from "@/lib/tesla/shift-state";
import { evaluateSohSampleEligible } from "@/lib/vehicle-soh-rules";

/** 주행 노이즈: 30초 미만 또는 0.1km 미만 → 세션 삭제 */
export const DRIVE_NOISE_MIN_MS = 30_000;
export const DRIVE_NOISE_MIN_KM = 0.1;

/** 충전 노이즈: 5분 미만이고 SOC 증가 &lt; 1%p → 세션 삭제 */
export const CHARGE_NOISE_MIN_MS = 5 * 60_000;
export const CHARGE_NOISE_MIN_ENERGY_PCT = 1;

export type ActivityObservation = {
  at: Date;
  shiftState?: string | null;
  chargingStatus?: ChargingStatus | null;
  status?: VehicleStatus | null;
  odometerKm?: number | null;
  batteryPercent?: number | null;
  chargingPowerKind?: string | null;
  chargerPowerKw?: number | null;
  vehicleSpeedKmh?: number | null;
  /** VD3-SOH */
  rangeKm?: number | null;
  chargeLimitSoc?: number | null;
};

export type OpenActivitySessions = {
  drive: VehicleActivitySession | null;
  charge: VehicleActivitySession | null;
};

export type ActivityFsmDecision =
  | { type: "open_drive" }
  | { type: "update_drive" }
  | { type: "close_drive"; discardNoise: boolean }
  | { type: "open_charge" }
  | { type: "update_charge" }
  | { type: "close_charge"; discardNoise: boolean };

/** 변속·속도 기준 주행 중 여부 */
export function isDrivingObservation(obs: ActivityObservation): boolean {
  const shift = normalizeShiftState(obs.shiftState);
  if (shift === "D" || shift === "R") return true;
  const speed = obs.vehicleSpeedKmh ?? 0;
  if (shift === "N" && speed > 0) return true;
  if (shift !== "P" && shift != null && speed >= 5) return true;
  return false;
}

/** 주차(P) 또는 절전 */
export function isParkedOrAsleepObservation(obs: ActivityObservation): boolean {
  if (obs.status === "ASLEEP") return true;
  return normalizeShiftState(obs.shiftState) === "P";
}

/** 세션을 열어 둔 채 갱신할 상태 (VD3-Hc: COMPLETE는 종료) */
export function isChargeConnectedStatus(
  status: ChargingStatus | null | undefined,
): boolean {
  return status === "CHARGING" || status === "STOPPED";
}

/** CHARGE 세션 종료 — 충전 완료 또는 케이블 해제 */
export function shouldCloseChargeSession(
  status: ChargingStatus | null | undefined,
): boolean {
  return status === "COMPLETE" || status === "DISCONNECTED";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeDriveDistanceKm(
  startOdo: number | null | undefined,
  endOdo: number | null | undefined,
): number | null {
  if (startOdo == null || endOdo == null) return null;
  const d = endOdo - startOdo;
  if (!Number.isFinite(d) || d < 0) return null;
  return round1(d);
}

function computeEnergyAdded(
  startPct: number | null | undefined,
  endPct: number | null | undefined,
): number | null {
  if (startPct == null || endPct == null) return null;
  const d = endPct - startPct;
  if (!Number.isFinite(d)) return null;
  return round1(Math.max(0, d));
}

export function isDriveNoise(input: {
  startedAt: Date;
  endedAt: Date;
  distanceKm: number | null;
}): boolean {
  const durationMs = input.endedAt.getTime() - input.startedAt.getTime();
  if (durationMs < DRIVE_NOISE_MIN_MS) return true;
  if (input.distanceKm != null && input.distanceKm < DRIVE_NOISE_MIN_KM) {
    return true;
  }
  return false;
}

export function isChargeNoise(input: {
  startedAt: Date;
  endedAt: Date;
  energyAddedPercent: number | null;
}): boolean {
  const durationMs = input.endedAt.getTime() - input.startedAt.getTime();
  const energy = input.energyAddedPercent ?? 0;
  return durationMs < CHARGE_NOISE_MIN_MS && energy < CHARGE_NOISE_MIN_ENERGY_PCT;
}

/**
 * 순수 FSM: open 세션 + 현재 관측 → 결정 목록 (순서대로 적용).
 * previous는 전이 힌트용(선택). 없어도 open 상태만으로 동작.
 */
export function planActivityTransitions(input: {
  open: OpenActivitySessions;
  current: ActivityObservation;
}): ActivityFsmDecision[] {
  const { open, current } = input;
  const decisions: ActivityFsmDecision[] = [];
  const driving = isDrivingObservation(current);
  const parkedOrAsleep = isParkedOrAsleepObservation(current);
  const chargeStatus = current.chargingStatus ?? null;

  // —— DRIVE ——
  if (open.drive) {
    if (parkedOrAsleep || (!driving && normalizeShiftState(current.shiftState) === "P")) {
      const distanceKm = computeDriveDistanceKm(
        open.drive.startOdometerKm,
        current.odometerKm ?? open.drive.endOdometerKm,
      );
      decisions.push({
        type: "close_drive",
        discardNoise: isDriveNoise({
          startedAt: open.drive.startedAt,
          endedAt: current.at,
          distanceKm,
        }),
      });
    } else if (driving) {
      decisions.push({ type: "update_drive" });
    }
  } else if (driving) {
    decisions.push({ type: "open_drive" });
  }

  // —— CHARGE ——
  if (open.charge) {
    if (shouldCloseChargeSession(chargeStatus)) {
      const energyAddedPercent = computeEnergyAdded(
        open.charge.startBatteryPercent,
        current.batteryPercent ?? open.charge.endBatteryPercent,
      );
      decisions.push({
        type: "close_charge",
        discardNoise: isChargeNoise({
          startedAt: open.charge.startedAt,
          endedAt: current.at,
          energyAddedPercent,
        }),
      });
    } else if (isChargeConnectedStatus(chargeStatus)) {
      decisions.push({ type: "update_charge" });
    }
  } else if (chargeStatus === "CHARGING") {
    decisions.push({ type: "open_charge" });
  }

  return decisions;
}

async function loadOpenSessions(vehicleId: string): Promise<OpenActivitySessions> {
  const open = await prisma.vehicleActivitySession.findMany({
    where: { vehicleId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  return {
    drive: open.find((s) => s.kind === "DRIVE") ?? null,
    charge: open.find((s) => s.kind === "CHARGE") ?? null,
  };
}

function peakKw(
  previous: number | null | undefined,
  next: number | null | undefined,
): number | null {
  if (previous == null && next == null) return null;
  if (previous == null) return next ?? null;
  if (next == null) return previous;
  return Math.max(previous, next);
}

/**
 * Snapshot append 직후 호출 — open 세션 FSM만 (풀 리플레이 금지).
 */
export async function applyActivitySessionFromObservation(
  vehicleId: string,
  observation: ActivityObservation,
  source: ActivitySessionSource = "TELEMETRY",
): Promise<{ applied: ActivityFsmDecision["type"][] }> {
  const open = await loadOpenSessions(vehicleId);
  const decisions = planActivityTransitions({ open, current: observation });
  const applied: ActivityFsmDecision["type"][] = [];

  let drive = open.drive;
  let charge = open.charge;

  for (const decision of decisions) {
    applied.push(decision.type);

    if (decision.type === "open_drive") {
      drive = await prisma.vehicleActivitySession.create({
        data: {
          vehicleId,
          kind: "DRIVE",
          startedAt: observation.at,
          startOdometerKm: observation.odometerKm ?? null,
          endOdometerKm: observation.odometerKm ?? null,
          startBatteryPercent: observation.batteryPercent ?? null,
          endBatteryPercent: observation.batteryPercent ?? null,
          source,
        },
      });
      continue;
    }

    if (decision.type === "update_drive" && drive) {
      drive = await prisma.vehicleActivitySession.update({
        where: { id: drive.id },
        data: {
          endOdometerKm: observation.odometerKm ?? drive.endOdometerKm,
          endBatteryPercent: observation.batteryPercent ?? drive.endBatteryPercent,
          distanceKm: computeDriveDistanceKm(
            drive.startOdometerKm,
            observation.odometerKm ?? drive.endOdometerKm,
          ),
        },
      });
      continue;
    }

    if (decision.type === "close_drive" && drive) {
      const endOdo = observation.odometerKm ?? drive.endOdometerKm;
      const distanceKm = computeDriveDistanceKm(drive.startOdometerKm, endOdo);
      if (decision.discardNoise) {
        await prisma.vehicleActivitySession.delete({ where: { id: drive.id } });
      } else {
        await prisma.vehicleActivitySession.update({
          where: { id: drive.id },
          data: {
            endedAt: observation.at,
            endOdometerKm: endOdo,
            endBatteryPercent:
              observation.batteryPercent ?? drive.endBatteryPercent,
            distanceKm,
          },
        });
      }
      drive = null;
      continue;
    }

    if (decision.type === "open_charge") {
      charge = await prisma.vehicleActivitySession.create({
        data: {
          vehicleId,
          kind: "CHARGE",
          startedAt: observation.at,
          startBatteryPercent: observation.batteryPercent ?? null,
          endBatteryPercent: observation.batteryPercent ?? null,
          chargingPowerKind: observation.chargingPowerKind ?? null,
          peakChargerPowerKw: observation.chargerPowerKw ?? null,
          endRangeKm: observation.rangeKm ?? null,
          endChargeLimitSoc: observation.chargeLimitSoc ?? null,
          sohSampleEligible: false,
          source,
        },
      });
      continue;
    }

    if (decision.type === "update_charge" && charge) {
      const endBatteryPercent =
        observation.batteryPercent ?? charge.endBatteryPercent;
      const endRangeKm = observation.rangeKm ?? charge.endRangeKm;
      const endChargeLimitSoc =
        observation.chargeLimitSoc ?? charge.endChargeLimitSoc;
      charge = await prisma.vehicleActivitySession.update({
        where: { id: charge.id },
        data: {
          endBatteryPercent,
          energyAddedPercent: computeEnergyAdded(
            charge.startBatteryPercent,
            endBatteryPercent,
          ),
          chargingPowerKind:
            observation.chargingPowerKind ?? charge.chargingPowerKind,
          peakChargerPowerKw: peakKw(
            charge.peakChargerPowerKw,
            observation.chargerPowerKw,
          ),
          endRangeKm,
          endChargeLimitSoc,
        },
      });
      continue;
    }

    if (decision.type === "close_charge" && charge) {
      const endBat = observation.batteryPercent ?? charge.endBatteryPercent;
      const endRangeKm = observation.rangeKm ?? charge.endRangeKm;
      const endChargeLimitSoc =
        observation.chargeLimitSoc ?? charge.endChargeLimitSoc;
      const energyAddedPercent = computeEnergyAdded(
        charge.startBatteryPercent,
        endBat,
      );
      if (decision.discardNoise) {
        await prisma.vehicleActivitySession.delete({ where: { id: charge.id } });
      } else {
        const sohSampleEligible = evaluateSohSampleEligible({
          endedAt: observation.at,
          endBatteryPercent: endBat,
          endRangeKm,
          endChargeLimitSoc,
          sawComplete: observation.chargingStatus === "COMPLETE",
        });
        await prisma.vehicleActivitySession.update({
          where: { id: charge.id },
          data: {
            endedAt: observation.at,
            endBatteryPercent: endBat,
            energyAddedPercent,
            chargingPowerKind:
              observation.chargingPowerKind ?? charge.chargingPowerKind,
            peakChargerPowerKw: peakKw(
              charge.peakChargerPowerKw,
              observation.chargerPowerKw,
            ),
            endRangeKm,
            endChargeLimitSoc,
            sohSampleEligible,
          },
        });
      }
      charge = null;
    }
  }

  return { applied };
}

export type ActivitySessionListItem = {
  id: string;
  kind: ActivitySessionKind;
  startedAt: string;
  endedAt: string | null;
  inProgress: boolean;
  distanceKm: number | null;
  startBatteryPercent: number | null;
  endBatteryPercent: number | null;
  energyAddedPercent: number | null;
  chargingPowerKind: string | null;
  peakChargerPowerKw: number | null;
  source: ActivitySessionSource;
};

export function serializeActivitySession(
  row: VehicleActivitySession,
): ActivitySessionListItem {
  return {
    id: row.id,
    kind: row.kind,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    inProgress: row.endedAt == null,
    distanceKm: row.distanceKm,
    startBatteryPercent: row.startBatteryPercent,
    endBatteryPercent: row.endBatteryPercent,
    energyAddedPercent: row.energyAddedPercent,
    chargingPowerKind: row.chargingPowerKind,
    peakChargerPowerKw: row.peakChargerPowerKw,
    source: row.source,
  };
}

export type ListActivitySessionsInput = {
  vehicleId: string;
  kind?: "all" | "drive" | "charge";
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listActivitySessions(
  input: ListActivitySessionsInput,
): Promise<{
  items: ActivitySessionListItem[];
  from: string;
  to: string;
  limit: number;
}> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const to = input.to ?? new Date();
  const from =
    input.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  const kindFilter =
    input.kind === "drive"
      ? ("DRIVE" as const)
      : input.kind === "charge"
        ? ("CHARGE" as const)
        : undefined;

  const rows = await prisma.vehicleActivitySession.findMany({
    where: {
      vehicleId: input.vehicleId,
      ...(kindFilter ? { kind: kindFilter } : {}),
      OR: [
        { startedAt: { gte: from, lte: to } },
        { endedAt: null },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: limit * 2,
  });

  // 진행 중 먼저, 그다음 startedAt desc
  const sorted = [...rows].sort((a, b) => {
    const aOpen = a.endedAt == null ? 0 : 1;
    const bOpen = b.endedAt == null ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.startedAt.getTime() - a.startedAt.getTime();
  });

  const items = sorted.slice(0, limit).map(serializeActivitySession);

  return {
    items,
    from: from.toISOString(),
    to: to.toISOString(),
    limit,
  };
}

// —— VD3-HS: 오늘/미운행 집계 ——

const KST = "Asia/Seoul";

/** KST 달력일 YYYY-MM-DD */
export function formatDateKeyKst(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** KST 해당 일자 00:00 (+09:00) */
export function startOfDayKst(d: Date = new Date()): Date {
  const key = formatDateKeyKst(d);
  return new Date(`${key}T00:00:00+09:00`);
}

/** 두 KST 달력일 사이 일수 (b − a) */
export function diffCalendarDaysKst(from: Date, to: Date): number {
  const a = startOfDayKst(from).getTime();
  const b = startOfDayKst(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function formatDriveDurationKo(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0분";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export type VehicleActivitySummary = {
  todayDistanceKm: number;
  todayDriveDurationMs: number;
  todayChargeCount: number;
  /** null = DRIVE 이력 없음 */
  idleDays: number | null;
  hasTodayDrive: boolean;
};

export type VehicleActivitySummaryDto = {
  todayDistanceKm: number;
  todayDriveDurationMs: number;
  todayChargeCount: number;
  idleDays: number | null;
  hasTodayDrive: boolean;
  /** 히스토리 헤더 카피 */
  historyLine: string;
  /** Hero 관제 요약 카피 · null이면 줄 생략 */
  heroLine: string | null;
  heroTone: "info" | "warn" | null;
};

export function buildHistorySummaryLine(s: VehicleActivitySummary): string {
  const drivePart = s.hasTodayDrive
    ? `오늘 주행 ${s.todayDistanceKm.toLocaleString("ko-KR")} km · ${formatDriveDurationKo(s.todayDriveDurationMs)}`
    : "오늘 주행 없음";
  const chargePart =
    s.todayChargeCount > 0 ? `충전 ${s.todayChargeCount}회` : "충전 없음";
  return `${drivePart} · ${chargePart}`;
}

export function buildHeroActivityLine(s: VehicleActivitySummary): {
  text: string | null;
  tone: "info" | "warn" | null;
} {
  if (s.hasTodayDrive) {
    return {
      text: `오늘 ${s.todayDistanceKm.toLocaleString("ko-KR")} km · ${formatDriveDurationKo(s.todayDriveDurationMs)}`,
      tone: "info",
    };
  }
  if (s.idleDays == null) {
    return { text: null, tone: null };
  }
  if (s.idleDays <= 0) {
    return { text: "오늘 운행 없음", tone: "info" };
  }
  return {
    text: `미운행 ${s.idleDays}일`,
    tone: s.idleDays >= 3 ? "warn" : "info",
  };
}

export function serializeActivitySummary(
  s: VehicleActivitySummary,
): VehicleActivitySummaryDto {
  const hero = buildHeroActivityLine(s);
  return {
    todayDistanceKm: s.todayDistanceKm,
    todayDriveDurationMs: s.todayDriveDurationMs,
    todayChargeCount: s.todayChargeCount,
    idleDays: s.idleDays,
    hasTodayDrive: s.hasTodayDrive,
    historyLine: buildHistorySummaryLine(s),
    heroLine: hero.text,
    heroTone: hero.tone,
  };
}

/**
 * 세션 행으로부터 오늘/미운행 집계 (순수 — 테스트용).
 *
 * 거리: 오늘(KST) 시작한 DRIVE + 진행 중 DRIVE의 distanceKm 합.
 * 시간: 오늘 구간과 겹치는 DRIVE의 overlap duration 합.
 * 충전: 오늘 시작 또는 진행 중 CHARGE 건수.
 * 미운행: 마지막 DRIVE 종료일 기준 KST 일수 (충전만으로는 깨지지 않음).
 */
export function computeActivitySummaryFromSessions(
  sessions: Array<{
    kind: ActivitySessionKind;
    startedAt: Date;
    endedAt: Date | null;
    distanceKm: number | null;
  }>,
  now: Date = new Date(),
): VehicleActivitySummary {
  const todayStart = startOfDayKst(now);
  const todayKey = formatDateKeyKst(now);

  let todayDistanceKm = 0;
  let todayDriveDurationMs = 0;
  let todayChargeCount = 0;
  let lastDriveAt: Date | null = null;
  let hasTodayDriveSession = false;

  for (const s of sessions) {
    if (s.kind === "DRIVE") {
      const end = s.endedAt ?? now;
      if (!lastDriveAt || end > lastDriveAt) lastDriveAt = end;

      const startedToday = formatDateKeyKst(s.startedAt) === todayKey;
      const inProgress = s.endedAt == null;
      if (startedToday || inProgress) {
        hasTodayDriveSession = true;
        todayDistanceKm += s.distanceKm ?? 0;
      }

      if (end >= todayStart && s.startedAt <= now) {
        const overlapStart =
          s.startedAt > todayStart ? s.startedAt : todayStart;
        if (end > overlapStart) {
          todayDriveDurationMs += end.getTime() - overlapStart.getTime();
        }
      }
    } else if (s.kind === "CHARGE") {
      if (formatDateKeyKst(s.startedAt) === todayKey || s.endedAt == null) {
        todayChargeCount += 1;
      }
    }
  }

  todayDistanceKm = round1(Math.max(0, todayDistanceKm));
  const hasTodayDrive =
    hasTodayDriveSession ||
    todayDistanceKm > 0 ||
    todayDriveDurationMs > 0;

  let idleDays: number | null = null;
  if (lastDriveAt == null) {
    idleDays = null;
  } else if (hasTodayDrive) {
    idleDays = 0;
  } else {
    idleDays = Math.max(0, diffCalendarDaysKst(lastDriveAt, now));
  }

  return {
    todayDistanceKm,
    todayDriveDurationMs,
    todayChargeCount,
    idleDays,
    hasTodayDrive,
  };
}

export async function summarizeVehicleActivity(
  vehicleId: string,
  now: Date = new Date(),
): Promise<VehicleActivitySummaryDto> {
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.vehicleActivitySession.findMany({
    where: {
      vehicleId,
      OR: [{ startedAt: { gte: lookback } }, { endedAt: null }],
    },
    select: {
      kind: true,
      startedAt: true,
      endedAt: true,
      distanceKm: true,
    },
    orderBy: { startedAt: "desc" },
    take: 500,
  });

  return serializeActivitySummary(
    computeActivitySummaryFromSessions(sessions, now),
  );
}
