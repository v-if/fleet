import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { getCurrentSession } from "@/lib/auth-session";
import { getSyncCronSecret } from "@/lib/tesla/config";
import { syncVehiclesFromProvider } from "@/lib/vehicle-sync";

function isAuthorized(request: Request) {
  const secret = getSyncCronSecret();
  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const session = await getCurrentSession();
  if (!session && !isAuthorized(request)) {
    await createAuditLogWithApiCall(
      {
        action: "SYNC_VEHICLES",
        targetType: "System",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "차량 동기화 거부: 인증되지 않은 요청",
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const forceFallback = searchParams.get("fallback") === "1";
    const result = await syncVehiclesFromProvider(session?.userId, {
      forceFallback,
      mode: forceFallback ? "full" : "auto",
    });
    await createAuditLogWithApiCall(
      {
        actorUserId: session?.userId ?? null,
        actorEmail: session?.email ?? null,
        action: "SYNC_VEHICLES",
        targetType: "System",
        requestId,
        status: AuditLogStatus.SUCCESS,
        summary: `차량 동기화 성공 (${result.vehicleCount}대)`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session?.userId ?? null,
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
    const message = error instanceof Error ? error.message : "Sync failed";
    await createAuditLogWithApiCall(
      {
        actorUserId: session?.userId ?? null,
        actorEmail: session?.email ?? null,
        action: "SYNC_VEHICLES",
        targetType: "System",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `차량 동기화 실패: ${message}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session?.userId ?? null,
        method: request.method,
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

export async function GET(request: Request) {
  return POST(request);
}
