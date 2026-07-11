import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { reconnectVehicleTelemetry } from "@/lib/tesla/telemetry/disconnect";
import { confirmVirtualKeyForVehicle } from "@/lib/tesla/hybrid/rest-sync";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/** 단절 해제 후 VK 확인·Baseline(기존 온보딩) 시도 */
export async function POST(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id: vehicleId } = await context.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      ...activeVehicleWhere,
      teslaAccount: { userId: session.userId },
    },
    select: { id: true, oemVehicleId: true },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  try {
    const reconnected = await reconnectVehicleTelemetry(vehicleId, {
      actorUserId: session.userId,
      requestId,
    });
    if (!reconnected?.ok) {
      return NextResponse.json(
        {
          error: reconnected?.error ?? "reconnect_failed",
          reconnect: reconnected,
        },
        { status: 409 },
      );
    }

    const vk = await confirmVirtualKeyForVehicle(vehicleId);

    const payload = { reconnect: reconnected, virtualKey: vk, subscribe: reconnected.subscribe };

    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "TELEMETRY_RECONNECT",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        requestId,
        status: vk.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
        summary: vk.ok
          ? `Telemetry 재연결·VK 확인 (${vehicle.oemVehicleId})`
          : `Telemetry 재연결 후 VK 미확인 (${vehicle.oemVehicleId})`,
        metadata: sanitizeBody(payload),
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session.userId,
        vehicleId,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 200,
        success: true,
        requestHeaders: sanitizeHeaders(request.headers),
        responseBody: sanitizeBody(payload),
      },
    );

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconnect failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
