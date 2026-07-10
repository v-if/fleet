import { ApiCallDirection } from "@prisma/client";

import { createApiCallLog, createRequestId, sanitizeBody, sanitizeHeaders } from "@/lib/audit-log";
import { getTeslaRegionConfig } from "@/lib/tesla/config";

import { getPartnerToken } from "./config";

export type TelemetryUnsubscribeResult = {
  ok: boolean;
  skipped?: boolean;
  stub?: boolean;
  statusCode?: number;
  error?: string;
};

export async function deleteFleetTelemetryConfig(
  vin: string,
  accessToken: string,
  options: {
    actorUserId?: string | null;
    teslaAccountId?: string | null;
    vehicleId?: string | null;
  } = {},
): Promise<TelemetryUnsubscribeResult> {
  const baseUrl = getTeslaRegionConfig().fleetApiBase;
  const path = `/api/1/vehicles/${encodeURIComponent(vin)}/fleet_telemetry_config`;
  const startedAt = Date.now();
  const requestId = createRequestId();

  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const responseText = await response.text();

  await createApiCallLog({
    direction: ApiCallDirection.OUTBOUND,
    system: "TESLA",
    requestId,
    actorUserId: options.actorUserId ?? null,
    teslaAccountId: options.teslaAccountId ?? null,
    vehicleId: options.vehicleId ?? null,
    method: "DELETE",
    url: `${baseUrl}${path}`,
    path,
    statusCode: response.status,
    success: response.ok || response.status === 404,
    durationMs: Date.now() - startedAt,
    requestHeaders: sanitizeHeaders({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    responseHeaders: sanitizeHeaders(response.headers),
    responseBody: sanitizeBody(responseText),
    errorMessage:
      response.ok || response.status === 404
        ? null
        : `Tesla Fleet Telemetry unsubscribe failed (${response.status})`,
  });

  if (response.ok || response.status === 404) {
    return { ok: true, statusCode: response.status };
  }

  return {
    ok: false,
    statusCode: response.status,
    error: responseText || `HTTP ${response.status}`,
  };
}

export async function unsubscribeFleetTelemetryForVin(
  vin: string,
  options: {
    userAccessToken?: string | null;
    actorUserId?: string | null;
    teslaAccountId?: string | null;
    vehicleId?: string | null;
  } = {},
): Promise<TelemetryUnsubscribeResult> {
  const partnerToken = getPartnerToken();
  const token = partnerToken ?? options.userAccessToken;

  if (!token) {
    console.info(`[telemetry] unsubscribe skipped for VIN ${vin}: no token configured`);
    return { ok: true, skipped: true, stub: true };
  }

  return deleteFleetTelemetryConfig(vin, token, options);
}
