import { ApiCallDirection, AuditLogStatus } from "@prisma/client";

import { createAuditLogWithApiCall } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getValidTeslaAccessToken } from "@/lib/tesla/auth";

import {
  createFleetTelemetryConfig,
  getFleetTelemetryConfig,
  unsubscribeFleetTelemetryForVin,
  type TelemetrySubscribeResult,
} from "./client";
import { isTelemetryEnabled } from "./config";
import { refreshTelemetryMetadataCounts } from "./ingress";

export type UnsubscribeTelemetryResult = {
  ok: boolean;
  skipped?: boolean;
  stub?: boolean;
  error?: string;
};

export async function unsubscribeVehicleTelemetry(
  vin: string | null | undefined,
  options: {
    vehicleId?: string | null;
    teslaAccountId?: string | null;
    actorUserId?: string | null;
    requestId?: string | null;
  } = {},
): Promise<UnsubscribeTelemetryResult> {
  if (!vin) {
    return { ok: true, skipped: true };
  }

  if (!isTelemetryEnabled()) {
    return { ok: true, skipped: true, stub: true };
  }

  let userAccessToken: string | null = null;
  let teslaAccountId = options.teslaAccountId ?? null;
  let actorUserId = options.actorUserId ?? null;

  if (options.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: options.vehicleId },
      include: {
        teslaAccount: {
          select: { id: true, userId: true },
        },
      },
    });
    teslaAccountId = vehicle?.teslaAccountId ?? teslaAccountId;
    actorUserId = vehicle?.teslaAccount?.userId ?? actorUserId;

    if (vehicle?.teslaAccount?.userId) {
      try {
        userAccessToken = await getValidTeslaAccessToken(vehicle.teslaAccount.userId);
      } catch {
        userAccessToken = null;
      }
    }
  }

  const result = await unsubscribeFleetTelemetryForVin(vin, {
    userAccessToken,
    actorUserId,
    teslaAccountId,
    vehicleId: options.vehicleId ?? null,
  });

  if (options.vehicleId) {
    await prisma.telemetrySubscription.updateMany({
      where: { vehicleId: options.vehicleId },
      data: {
        active: false,
        unsubscribedAt: new Date(),
        lastError: result.ok ? null : result.error ?? "unsubscribe failed",
      },
    });
  }

  await createAuditLogWithApiCall(
    {
      actorUserId,
      action: "TELEMETRY_UNSUBSCRIBE",
      targetType: "Vehicle",
      targetId: options.vehicleId ?? vin,
      vehicleId: options.vehicleId ?? null,
      teslaAccountId,
      requestId: options.requestId ?? null,
      status: result.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
      summary: result.ok
        ? `Fleet Telemetry 구독 해제: ${vin}`
        : `Fleet Telemetry 구독 해제 실패: ${vin}`,
      metadata: {
        vin,
        skipped: result.skipped ?? false,
        stub: result.stub ?? false,
        statusCode: result.statusCode ?? null,
      },
    },
    {
      direction: ApiCallDirection.OUTBOUND,
      system: "TESLA",
      requestId: options.requestId ?? null,
      actorUserId,
      teslaAccountId,
      vehicleId: options.vehicleId ?? null,
      method: "DELETE",
      url: `/api/1/vehicles/${vin}/fleet_telemetry_config`,
      path: `/api/1/vehicles/${vin}/fleet_telemetry_config`,
      statusCode: result.statusCode ?? (result.ok ? 200 : 500),
      success: result.ok,
      errorMessage: result.error ?? null,
    },
  );

  return {
    ok: result.ok,
    skipped: result.skipped,
    stub: result.stub,
    error: result.error,
  };
}

async function resolveVehicleTokenContext(options: {
  vehicleId?: string | null;
  teslaAccountId?: string | null;
  actorUserId?: string | null;
}) {
  let userAccessToken: string | null = null;
  let teslaAccountId = options.teslaAccountId ?? null;
  let actorUserId = options.actorUserId ?? null;

  if (options.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: options.vehicleId },
      include: {
        teslaAccount: {
          select: { id: true, userId: true },
        },
      },
    });
    teslaAccountId = vehicle?.teslaAccountId ?? teslaAccountId;
    actorUserId = vehicle?.teslaAccount?.userId ?? actorUserId;

    if (vehicle?.teslaAccount?.userId) {
      try {
        userAccessToken = await getValidTeslaAccessToken(vehicle.teslaAccount.userId);
      } catch {
        userAccessToken = null;
      }
    }
  }

  return { userAccessToken, teslaAccountId, actorUserId };
}

/**
 * 단절(DELETE) 이후 재구독.
 * 1) GET으로 기존 config 확인 2) 없으면 Vehicle Command Proxy로 create
 */
export async function subscribeVehicleTelemetry(
  vin: string | null | undefined,
  options: {
    vehicleId?: string | null;
    teslaAccountId?: string | null;
    actorUserId?: string | null;
    requestId?: string | null;
  } = {},
): Promise<TelemetrySubscribeResult> {
  if (!vin) {
    return { ok: false, error: "vin_missing" };
  }
  if (!isTelemetryEnabled()) {
    return { ok: true, skipped: true };
  }

  const ctx = await resolveVehicleTokenContext(options);
  if (!ctx.userAccessToken) {
    return { ok: false, error: "tesla_access_token_missing" };
  }

  const current = await getFleetTelemetryConfig(vin, ctx.userAccessToken, {
    actorUserId: ctx.actorUserId,
    teslaAccountId: ctx.teslaAccountId,
    vehicleId: options.vehicleId ?? null,
  });

  if (current.ok && current.hasConfig) {
    if (options.vehicleId) {
      await prisma.telemetrySubscription.updateMany({
        where: { vehicleId: options.vehicleId },
        data: {
          active: true,
          configSynced: current.synced === true,
          configCheckedAt: new Date(),
          lastError: null,
          unsubscribedAt: null,
        },
      });
    }
    return { ok: true, alreadyConfigured: true };
  }

  const created = await createFleetTelemetryConfig(vin, ctx.userAccessToken, {
    actorUserId: ctx.actorUserId,
    teslaAccountId: ctx.teslaAccountId,
    vehicleId: options.vehicleId ?? null,
  });

  if (options.vehicleId) {
    await prisma.telemetrySubscription.updateMany({
      where: { vehicleId: options.vehicleId },
      data: {
        active: true,
        configSynced: false,
        configCheckedAt: new Date(),
        lastError: created.ok ? null : created.error ?? "subscribe failed",
        unsubscribedAt: null,
      },
    });
  }

  await createAuditLogWithApiCall(
    {
      actorUserId: ctx.actorUserId,
      action: "TELEMETRY_SUBSCRIBE",
      targetType: "Vehicle",
      targetId: options.vehicleId ?? vin,
      vehicleId: options.vehicleId ?? null,
      teslaAccountId: ctx.teslaAccountId,
      requestId: options.requestId ?? null,
      status: created.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
      summary: created.ok
        ? `Fleet Telemetry 구독 등록: ${vin}`
        : `Fleet Telemetry 구독 등록 실패: ${vin}`,
      metadata: {
        vin,
        viaProxy: created.viaProxy ?? false,
        statusCode: created.statusCode ?? null,
        error: created.error ?? null,
      },
    },
    {
      direction: ApiCallDirection.OUTBOUND,
      system: "TESLA",
      requestId: options.requestId ?? null,
      actorUserId: ctx.actorUserId,
      teslaAccountId: ctx.teslaAccountId,
      vehicleId: options.vehicleId ?? null,
      method: "POST",
      url: `/api/1/vehicles/fleet_telemetry_config`,
      path: `/api/1/vehicles/fleet_telemetry_config`,
      statusCode: created.statusCode ?? (created.ok ? 200 : 500),
      success: created.ok,
      errorMessage: created.error ?? null,
    },
  );

  return created;
}

export async function ensureTelemetrySubscriptionsForAccount(teslaAccountId: string) {
  if (!isTelemetryEnabled()) {
    return { ensured: 0 };
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      teslaAccountId,
      oemVehicleId: { not: null },
      unlinkedAt: null,
      isDeleted: false,
    },
    select: {
      id: true,
      oemVehicleId: true,
    },
  });

  let ensured = 0;

  for (const vehicle of vehicles) {
    if (!vehicle.oemVehicleId) continue;

    await prisma.telemetrySubscription.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        vin: vehicle.oemVehicleId,
        teslaAccountId,
        active: true,
        unsubscribedAt: null,
        lastError: null,
      },
      create: {
        vehicleId: vehicle.id,
        vin: vehicle.oemVehicleId,
        teslaAccountId,
        active: true,
      },
    });
    ensured += 1;
  }

  await refreshTelemetryMetadataCounts();

  await createAuditLogWithApiCall(
    {
      action: "TELEMETRY_SUBSCRIBE_ENSURE",
      targetType: "TeslaAccount",
      targetId: teslaAccountId,
      teslaAccountId,
      status: AuditLogStatus.SUCCESS,
      summary: `Telemetry 구독 대상 등록: ${ensured}대 (webhook 수신 대기)`,
      metadata: {
        vehicleCount: ensured,
        note: "Tesla fleet_telemetry_config는 Vehicle Command Proxy/텔레메트리 서버에서 별도 구성",
      },
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      teslaAccountId,
      method: "INTERNAL",
      url: "/internal/telemetry/subscribe",
      path: "/internal/telemetry/subscribe",
      statusCode: 200,
      success: true,
      responseBody: { ensured },
    },
  );

  return { ensured };
}
