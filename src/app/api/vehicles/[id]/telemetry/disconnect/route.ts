import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { disconnectVehicleTelemetry } from "@/lib/tesla/telemetry/disconnect";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

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
    const result = await disconnectVehicleTelemetry(vehicleId, {
      actorUserId: session.userId,
      requestId,
    });

    if (!result) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "TELEMETRY_DISCONNECT",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        requestId,
        status: AuditLogStatus.SUCCESS,
        summary: `Telemetry 연동 해제 API (${vehicle.oemVehicleId})`,
        metadata: sanitizeBody(result),
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
        responseBody: sanitizeBody(result),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Disconnect failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
