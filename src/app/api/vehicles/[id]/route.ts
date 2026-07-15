import { NextResponse } from "next/server";
import { ApiCallDirection, AuditLogStatus } from "@prisma/client";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { getVehicleDetail } from "@/lib/vehicles";
import { updateVehicleDisplayName } from "@/lib/vehicle-display-name";
import { isTelemetryPrimaryMode } from "@/lib/tesla/telemetry/config";
import { inferAsleepVehicles } from "@/lib/tesla/telemetry/processor";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * 차량 상세.
 * Phase AS-H (Hobby): Telemetry primary 시 inferAsleepVehicles — 안 1
 * (목록과 동일 side-effect로 주차(절전)/ONLINE 정합).
 * Pro(안 2)에서는 Cron SoT 후 본 블록 제거 (AS-6).
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  if (isTelemetryPrimaryMode()) {
    try {
      await inferAsleepVehicles();
    } catch (error) {
      console.warn("Telemetry asleep inference failed:", error);
    }
  }

  const { id } = await context.params;
  const vehicle = await getVehicleDetail(id);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({
    provider: process.env.VEHICLE_DATA_PROVIDER ?? "mock",
    vehicle,
  });
}

/** VD3-N: FMS 표시명(plateNumber) 수동 수정 */
export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    await createAuditLogWithApiCall(
      {
        action: "vehicle.display_name_update",
        targetType: "Vehicle",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "차량 표시명 변경 거부: 인증되지 않은 요청",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 401,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Unauthorized",
      },
    );
    return session;
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plateNumber =
    body && typeof body === "object" && "plateNumber" in body
      ? (body as { plateNumber?: unknown }).plateNumber
      : undefined;

  const result = await updateVehicleDisplayName(
    id,
    plateNumber,
    { userId: session.userId, email: session.email },
    {
      requestId,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
    },
  );

  if (!result.ok) {
    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "vehicle.display_name_update",
        targetType: "Vehicle",
        targetId: id,
        vehicleId: id,
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `차량 표시명 변경 실패: ${result.error}`,
        metadata: sanitizeBody({ plateNumber }),
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session.userId,
        vehicleId: id,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: result.status,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ plateNumber }),
        errorMessage: result.error,
      },
    );
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    provider: process.env.VEHICLE_DATA_PROVIDER ?? "mock",
    vehicle: result.vehicle,
  });
}
