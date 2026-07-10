import { ApiCallDirection, AuditLogStatus } from "@prisma/client";

import { createAuditLogWithApiCall } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getValidTeslaAccessToken } from "@/lib/tesla/auth";

import { unsubscribeFleetTelemetryForVin } from "./client";
import { isTelemetryEnabled } from "./config";

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
