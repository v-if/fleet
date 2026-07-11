import {
  AuditLogStatus,
  TelemetryDisconnectReason,
  VehicleLifecycle,
} from "@prisma/client";

import { createAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { patchVehicleSyncState } from "@/lib/tesla/hybrid/sync-state";
import { unsubscribeVehicleTelemetry } from "@/lib/tesla/telemetry/subscription";
import { activeVehicleWhere } from "@/lib/vehicle-query";

export type DisconnectTelemetryResult = {
  ok: boolean;
  vehicleId: string;
  vin: string | null;
  teslaUnsubscribe: {
    ok: boolean;
    skipped?: boolean;
    stub?: boolean;
    error?: string;
  };
  error?: string;
};

/**
 * Phase 4.5.A — Telemetry 구독만 해제. Vehicle soft-delete 하지 않음.
 * Tesla DELETE 실패해도 DB는 단절로 두고 lastError 기록 (과금 우선 중지).
 */
export async function disconnectVehicleTelemetry(
  vehicleId: string,
  options: {
    reason?: TelemetryDisconnectReason;
    actorUserId?: string | null;
    requestId?: string | null;
  } = {},
): Promise<DisconnectTelemetryResult | null> {
  const reason = options.reason ?? TelemetryDisconnectReason.USER_SOFTWARE;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...activeVehicleWhere },
    include: { telemetrySubscription: true },
  });

  if (!vehicle) return null;

  const teslaUnsubscribe = await unsubscribeVehicleTelemetry(vehicle.oemVehicleId, {
    vehicleId: vehicle.id,
    teslaAccountId: vehicle.teslaAccountId,
    actorUserId: options.actorUserId,
    requestId: options.requestId,
  });

  const now = new Date();
  const lastError = teslaUnsubscribe.ok
    ? null
    : (teslaUnsubscribe.error ?? "fleet_telemetry_config delete failed");

  await prisma.telemetrySubscription.upsert({
    where: { vehicleId: vehicle.id },
    create: {
      vehicleId: vehicle.id,
      vin: vehicle.oemVehicleId ?? "UNKNOWN",
      teslaAccountId: vehicle.teslaAccountId,
      active: false,
      configSynced: false,
      unsubscribedAt: now,
      disconnectedAt: now,
      disconnectReason: reason,
      lastError,
    },
    update: {
      active: false,
      configSynced: false,
      configCheckedAt: null,
      unsubscribedAt: now,
      disconnectedAt: now,
      disconnectReason: reason,
      lastError,
    },
  });

  await patchVehicleSyncState(vehicle.id, {
    lifecycle: VehicleLifecycle.TELEMETRY_DISCONNECTED,
  });

  await createAuditLog({
    actorUserId: options.actorUserId,
    action: "TELEMETRY_DISCONNECT",
    targetType: "Vehicle",
    targetId: vehicle.id,
    vehicleId: vehicle.id,
    teslaAccountId: vehicle.teslaAccountId,
    requestId: options.requestId,
    status: teslaUnsubscribe.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
    summary: teslaUnsubscribe.ok
      ? `Telemetry 연동 해제 (${vehicle.oemVehicleId ?? vehicle.id})`
      : `Telemetry 연동 해제(DB 단절, Tesla 오류): ${lastError}`,
    metadata: {
      reason,
      vin: vehicle.oemVehicleId,
      teslaOk: teslaUnsubscribe.ok,
      softDelete: false,
    },
  });

  return {
    ok: true,
    vehicleId: vehicle.id,
    vin: vehicle.oemVehicleId,
    teslaUnsubscribe,
    error: lastError ?? undefined,
  };
}

/** 단절 해제 후 온보딩 재개 (VK 확인·Baseline은 호출측/기존 API) */
export async function reconnectVehicleTelemetry(
  vehicleId: string,
  options: { actorUserId?: string | null; requestId?: string | null } = {},
): Promise<{ ok: boolean; vehicleId: string; error?: string } | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...activeVehicleWhere },
  });
  if (!vehicle) return null;
  if (!vehicle.oemVehicleId) {
    return { ok: false, vehicleId, error: "vin_missing" };
  }

  const now = new Date();
  await prisma.telemetrySubscription.upsert({
    where: { vehicleId: vehicle.id },
    create: {
      vehicleId: vehicle.id,
      vin: vehicle.oemVehicleId,
      teslaAccountId: vehicle.teslaAccountId,
      active: true,
      subscribedAt: now,
    },
    update: {
      active: true,
      unsubscribedAt: null,
      disconnectedAt: null,
      disconnectReason: null,
      lastError: null,
      configSynced: false,
    },
  });

  await patchVehicleSyncState(vehicle.id, {
    lifecycle: VehicleLifecycle.TELEMETRY_PENDING,
  });

  await createAuditLog({
    actorUserId: options.actorUserId,
    action: "TELEMETRY_RECONNECT",
    targetType: "Vehicle",
    targetId: vehicle.id,
    vehicleId: vehicle.id,
    teslaAccountId: vehicle.teslaAccountId,
    requestId: options.requestId,
    status: AuditLogStatus.SUCCESS,
    summary: `Telemetry 재연결 준비 (${vehicle.oemVehicleId})`,
    metadata: { vin: vehicle.oemVehicleId },
  });

  return { ok: true, vehicleId: vehicle.id };
}
