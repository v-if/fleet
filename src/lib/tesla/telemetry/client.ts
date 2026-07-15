import { ApiCallDirection } from "@prisma/client";

import { createApiCallLog, createRequestId, sanitizeBody, sanitizeHeaders } from "@/lib/audit-log";
import { getTeslaRegionConfig } from "@/lib/tesla/config";

import {
  getPartnerToken,
  getTelemetryCaPem,
  getTelemetryPublicHost,
  getVehicleCommandProxyUrl,
} from "./config";
import { getDefaultTelemetryFields } from "./default-fields";

export type TelemetryUnsubscribeResult = {
  ok: boolean;
  skipped?: boolean;
  stub?: boolean;
  statusCode?: number;
  error?: string;
};

export type TelemetryConfigGetResult = {
  ok: boolean;
  statusCode?: number;
  synced?: boolean;
  hasConfig?: boolean;
  keyPaired?: boolean;
  config?: unknown;
  error?: string;
  raw?: unknown;
};

export type TelemetrySubscribeResult = {
  ok: boolean;
  skipped?: boolean;
  alreadyConfigured?: boolean;
  statusCode?: number;
  error?: string;
  viaProxy?: boolean;
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

export async function getFleetTelemetryConfig(
  vin: string,
  accessToken: string,
  options: {
    actorUserId?: string | null;
    teslaAccountId?: string | null;
    vehicleId?: string | null;
  } = {},
): Promise<TelemetryConfigGetResult> {
  const baseUrl = getTeslaRegionConfig().fleetApiBase;
  const path = `/api/1/vehicles/${encodeURIComponent(vin)}/fleet_telemetry_config`;
  const startedAt = Date.now();
  const requestId = createRequestId();

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const responseText = await response.text();
  type ConfigGetBody = {
    response?: {
      synced?: boolean;
      config?: unknown;
      key_paired?: boolean;
    };
  };
  let parsed: ConfigGetBody | null = null;
  try {
    parsed = JSON.parse(responseText) as ConfigGetBody;
  } catch {
    parsed = null;
  }

  await createApiCallLog({
    direction: ApiCallDirection.OUTBOUND,
    system: "TESLA",
    requestId,
    actorUserId: options.actorUserId ?? null,
    teslaAccountId: options.teslaAccountId ?? null,
    vehicleId: options.vehicleId ?? null,
    method: "GET",
    url: `${baseUrl}${path}`,
    path,
    statusCode: response.status,
    success: response.ok,
    durationMs: Date.now() - startedAt,
    requestHeaders: sanitizeHeaders({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    responseHeaders: sanitizeHeaders(response.headers),
    responseBody: sanitizeBody(responseText),
    errorMessage: response.ok ? null : `fleet_telemetry_config get failed (${response.status})`,
  });

  if (!response.ok) {
    return {
      ok: false,
      statusCode: response.status,
      error: responseText || `HTTP ${response.status}`,
    };
  }

  const config = parsed?.response?.config ?? null;
  return {
    ok: true,
    statusCode: response.status,
    synced: parsed?.response?.synced === true,
    hasConfig: config != null,
    keyPaired: parsed?.response?.key_paired === true,
    config,
    raw: parsed,
  };
}

/**
 * DELETE 이후 재구독. Vehicle Command Proxy로 서명 POST가 권장.
 * Proxy/CA 미설정 시 명확한 오류를 반환한다.
 */
export async function createFleetTelemetryConfig(
  vin: string,
  accessToken: string,
  options: {
    actorUserId?: string | null;
    teslaAccountId?: string | null;
    vehicleId?: string | null;
  } = {},
): Promise<TelemetrySubscribeResult> {
  const proxyBase = getVehicleCommandProxyUrl();
  const ca = getTelemetryCaPem();
  const hostname = getTelemetryPublicHost();

  if (!proxyBase) {
    return {
      ok: false,
      error:
        "TESLA_VEHICLE_COMMAND_PROXY_URL 미설정 — fleet_telemetry_config 재등록에는 Vehicle Command Proxy가 필요합니다",
    };
  }
  if (!ca) {
    return {
      ok: false,
      error:
        "TESLA_TELEMETRY_CA_PEM 미설정 — Telemetry 서버 CA(PEM)가 config create에 필요합니다",
    };
  }

  const path = `/api/1/vehicles/fleet_telemetry_config`;
  const url = `${proxyBase}${path}`;
  const body = {
    vins: [vin],
    config: {
      hostname,
      port: 443,
      ca,
      fields: getDefaultTelemetryFields(),
      prefer_typed: true,
    },
  };

  const startedAt = Date.now();
  const requestId = createRequestId();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();

  await createApiCallLog({
    direction: ApiCallDirection.OUTBOUND,
    system: "TESLA",
    requestId,
    actorUserId: options.actorUserId ?? null,
    teslaAccountId: options.teslaAccountId ?? null,
    vehicleId: options.vehicleId ?? null,
    method: "POST",
    url,
    path,
    statusCode: response.status,
    success: response.ok,
    durationMs: Date.now() - startedAt,
    requestHeaders: sanitizeHeaders({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    requestBody: sanitizeBody({
      vins: body.vins,
      config: { ...body.config, ca: "[redacted]" },
    }),
    responseHeaders: sanitizeHeaders(response.headers),
    responseBody: sanitizeBody(responseText),
    errorMessage: response.ok
      ? null
      : `fleet_telemetry_config create failed (${response.status})`,
  });

  if (!response.ok) {
    return {
      ok: false,
      statusCode: response.status,
      viaProxy: true,
      error: responseText || `HTTP ${response.status}`,
    };
  }

  return { ok: true, statusCode: response.status, viaProxy: true };
}
