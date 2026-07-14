import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { getSyncCronSecret } from "@/lib/tesla/config";
import { isTelemetryEnabled } from "@/lib/tesla/telemetry/config";
import { refreshTelemetryMetadataCounts } from "@/lib/tesla/telemetry/ingress";
import {
  inferAsleepVehicles,
  processPendingTelemetryIngress,
} from "@/lib/tesla/telemetry/processor";

export const dynamic = "force-dynamic";

/**
 * Phase AS — Telemetry 후처리 + ASLEEP/ONLINE 추론 SoT.
 * Vercel Cron: GET 이 경로를 2분마다 호출 (vercel.json).
 * 인증: Authorization Bearer = TESLA_SYNC_CRON_SECRET 또는 CRON_SECRET.
 */
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

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTelemetryEnabled()) {
    return NextResponse.json({ error: "Telemetry disabled" }, { status: 503 });
  }

  try {
    const processed = await processPendingTelemetryIngress();
    const asleep = await inferAsleepVehicles();
    await refreshTelemetryMetadataCounts();

    const result = {
      ...processed,
      asleepUpdated: asleep.updated,
    };

    await createAuditLogWithApiCall(
      {
        action: "TELEMETRY_PROCESS",
        targetType: "System",
        requestId,
        status: AuditLogStatus.SUCCESS,
        summary: `Telemetry 후처리 완료 (processed=${processed.processed}, failed=${processed.failed})`,
        metadata: result,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 200,
        success: true,
        requestHeaders: sanitizeHeaders(request.headers),
        responseBody: result,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telemetry process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
