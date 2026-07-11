import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { confirmVirtualKeyForVehicle } from "@/lib/tesla/hybrid/rest-sync";
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
    const result = await confirmVirtualKeyForVehicle(vehicleId);

    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "VEHICLE_VIRTUAL_KEY_CONFIRM",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        requestId,
        status: result.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
        summary: result.ok
          ? `Virtual Key 확인 API 성공 (${vehicle.oemVehicleId})`
          : `Virtual Key 확인 API 실패: ${result.error}`,
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
        statusCode: result.ok ? 200 : 409,
        success: result.ok,
        requestHeaders: sanitizeHeaders(request.headers),
        responseBody: sanitizeBody(result),
      },
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Virtual key confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
