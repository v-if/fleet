import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { after, NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { isTelemetryEnabled, getTelemetryWebhookSecret } from "@/lib/tesla/telemetry/config";
import { saveTelemetryIngress } from "@/lib/tesla/telemetry/ingress";
import { extractTelemetryMessages } from "@/lib/tesla/telemetry/mapper";
import {
  inferAsleepVehicles,
  processPendingTelemetryIngress,
  processTelemetryIngressById,
} from "@/lib/tesla/telemetry/processor";

export const dynamic = "force-dynamic";

function verifyTelemetryRequest(request: Request) {
  const secret = getTelemetryWebhookSecret();
  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  const headerSecret = request.headers.get("x-telemetry-secret");
  return headerSecret === secret;
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const startedAt = Date.now();

  if (!isTelemetryEnabled()) {
    await createAuditLogWithApiCall(
      {
        action: "TELEMETRY_INGRESS",
        targetType: "System",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "Telemetry 수신 거부: 기능 비활성화",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "TESLA",
        requestId,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 503,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Telemetry disabled",
      },
    );
    return NextResponse.json({ error: "Telemetry disabled" }, { status: 503 });
  }

  if (!verifyTelemetryRequest(request)) {
    await createAuditLogWithApiCall(
      {
        action: "TELEMETRY_INGRESS",
        targetType: "System",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "Telemetry 수신 거부: 인증 실패",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "TESLA",
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await createAuditLogWithApiCall(
      {
        action: "TELEMETRY_INGRESS",
        targetType: "System",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: "Telemetry 수신 실패: JSON 파싱 오류",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "TESLA",
        requestId,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 400,
        success: false,
        durationMs: Date.now() - startedAt,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Invalid JSON",
      },
    );
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const idempotencyKey =
    request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key");
  const messages = extractTelemetryMessages(payload);
  const vin = messages[0]?.vin ?? messages[0]?.VIN ?? null;

  const ingress = await saveTelemetryIngress(payload, {
    idempotencyKey,
    vin: typeof vin === "string" ? vin : null,
  });

  const responseBody = {
    ok: true,
    ingressId: ingress.id,
    duplicate: ingress.duplicate,
  };

  await createAuditLogWithApiCall(
    {
      action: ingress.duplicate ? "TELEMETRY_INGRESS_DUPLICATE" : "TELEMETRY_INGRESS",
      targetType: "TelemetryIngress",
      targetId: ingress.id,
      requestId,
      status: AuditLogStatus.SUCCESS,
      summary: ingress.duplicate
        ? `Telemetry 중복 수신 discard: ${ingress.id}`
        : `Telemetry 수신 저장: ${ingress.id}`,
      metadata: {
        vin,
        duplicate: ingress.duplicate,
      },
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "TESLA",
      requestId,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      statusCode: 200,
      success: true,
      durationMs: Date.now() - startedAt,
      requestHeaders: sanitizeHeaders(request.headers),
      requestBody: sanitizeBody({ vin, messageCount: messages.length }),
      responseBody: sanitizeBody(responseBody),
    },
  );

  if (!ingress.duplicate) {
    after(async () => {
      try {
        await processTelemetryIngressById(ingress.id);
        await inferAsleepVehicles();
      } catch (error) {
        console.error("Telemetry async processing failed:", error);
      }
    });
  }

  return NextResponse.json(responseBody, { status: 200 });
}
