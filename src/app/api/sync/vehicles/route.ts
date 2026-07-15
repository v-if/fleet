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
    const frozenBlocked = Boolean(result.frozenFallbackBlocked);
    await createAuditLogWithApiCall(
      {
        actorUserId: session?.userId ?? null,
        actorEmail: session?.email ?? null,
        action: "SYNC_VEHICLES",
        targetType: "System",
        requestId,
        status: frozenBlocked ? AuditLogStatus.FAILURE : AuditLogStatus.SUCCESS,
        summary: frozenBlocked
          ? `REST Freeze: fallback 거부 (registry-only, ${result.vehicleCount}대)`
          : forceFallback
            ? `수동 REST fallback 동기화 성공 (${result.vehicleCount}대)`
            : `차량 동기화 성공 (${result.vehicleCount}대)`,
        metadata: {
          forceFallback,
          syncMode: result.syncMode,
          usedFallback: result.usedFallback,
          restFreeze: result.restFreeze ?? false,
          frozenFallbackBlocked: frozenBlocked,
          restSyncReason: forceFallback && !frozenBlocked ? "MANUAL_FALLBACK" : null,
          snapshotsWritten: result.snapshotsWritten,
          baselineAttempted: result.baselineAttempted,
          baselineSucceeded: result.baselineSucceeded,
        },
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session?.userId ?? null,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: frozenBlocked ? 403 : 200,
        success: !frozenBlocked,
        requestHeaders: sanitizeHeaders(request.headers),
        responseBody: sanitizeBody(result),
        errorMessage: frozenBlocked ? "rest_freeze" : null,
      },
    );
    if (frozenBlocked) {
      return NextResponse.json(
        { ...result, error: "rest_freeze" },
        { status: 403 },
      );
    }
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
