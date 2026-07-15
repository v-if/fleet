import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { runBaselineForVehicle } from "@/lib/tesla/hybrid/rest-sync";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/** Baseline vehicle_data 재시도 — 실패 시 wake 금지 */
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
    const result = await runBaselineForVehicle(vehicleId);
    const errorMessage = result.ok ? null : result.error;

    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "VEHICLE_BASELINE_RETRY",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        requestId,
        status: result.ok ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
        summary: result.ok
          ? `Baseline 제원(specs_only) 성공 (${vehicle.oemVehicleId})`
          : `Baseline 재시도 실패: ${errorMessage}`,
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
        errorMessage: result.ok ? null : (errorMessage ?? "baseline_failed"),
      },
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Baseline retry failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
