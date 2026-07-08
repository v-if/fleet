import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { disconnectTeslaAccount, getStoredTeslaToken, isTeslaConnected } from "@/lib/tesla/auth";
import { isTeslaConfigured } from "@/lib/tesla/config";
import { getSyncMetadata } from "@/lib/vehicle-sync";
import { getVehicleProviderName } from "@/lib/vehicle-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const [connected, token, syncMetadata] = await Promise.all([
    isTeslaConnected(session.userId),
    getStoredTeslaToken(session.userId),
    getSyncMetadata(),
  ]);

  return NextResponse.json({
    configured: isTeslaConfigured(),
    connected,
    provider: getVehicleProviderName(),
    scope: token?.scope ?? null,
    expiresAt: token?.expiresAt.toISOString() ?? null,
    sync: syncMetadata
      ? {
          lastSyncedAt: syncMetadata.lastSyncedAt?.toISOString() ?? null,
          provider: syncMetadata.provider,
          usedFallback: syncMetadata.usedFallback,
          lastError: syncMetadata.lastError,
        }
      : null,
  });
}

export async function DELETE(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    await createAuditLogWithApiCall(
      {
        action: "TESLA_DISCONNECT",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "Tesla 연결 해제 거부: 인증되지 않은 요청",
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

  await disconnectTeslaAccount(session.userId);
  await createAuditLogWithApiCall(
    {
      actorUserId: session.userId,
      actorEmail: session.email,
      action: "TESLA_DISCONNECT",
      targetType: "TeslaAccount",
      requestId,
      status: AuditLogStatus.SUCCESS,
      summary: `Tesla 연결 해제: ${session.email}`,
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      requestId,
      actorUserId: session.userId,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      statusCode: 200,
      success: true,
      requestHeaders: sanitizeHeaders(request.headers),
      responseBody: { connected: false },
    },
  );
  return NextResponse.json({ connected: false });
}
