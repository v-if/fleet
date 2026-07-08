import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { createVirtualTeslaAccountWithVehicles } from "@/lib/virtual-vehicles";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    await createAuditLogWithApiCall(
      {
        action: "VIRTUAL_VEHICLE_SEED",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "가상 차량 생성 거부: 인증되지 않은 요청",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "POST",
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

  try {
    const result = await createVirtualTeslaAccountWithVehicles({
      userId: session.userId,
      userEmail: session.email,
      requestId,
    });
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Virtual vehicle seed failed";
    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "VIRTUAL_VEHICLE_SEED",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `가상 차량 생성 실패: ${message}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session.userId,
        method: "POST",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 500,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: message,
      },
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
