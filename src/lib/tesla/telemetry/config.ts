export function isTelemetryEnabled(): boolean {
  const value = process.env.TESLA_TELEMETRY_ENABLED;
  if (value === "false" || value === "0") {
    return false;
  }
  return true;
}

/** Telemetry 활성 시 REST 주기 폴링 자동 실행 여부 (기본: 비활성) */
export function isRestAutoSyncEnabled(): boolean {
  if (!isTelemetryEnabled()) {
    return true;
  }

  const value = process.env.TESLA_REST_AUTO_SYNC_ENABLED;
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }

  return false;
}

/** Telemetry webhook이 실데이터 1차 소스인 운영 모드 */
export function isTelemetryPrimaryMode(): boolean {
  return isTelemetryEnabled() && !isRestAutoSyncEnabled();
}

export type VehicleSyncMode = "full" | "registry";

export function resolveVehicleSyncMode(options?: {
  forceFallback?: boolean;
  mode?: VehicleSyncMode | "auto";
}): VehicleSyncMode {
  if (options?.forceFallback || options?.mode === "full") {
    return "full";
  }
  if (options?.mode === "registry") {
    return "registry";
  }
  return isTelemetryPrimaryMode() ? "registry" : "full";
}

export function getTelemetryWebhookUrl(): string | null {
  const explicit = process.env.TESLA_TELEMETRY_WEBHOOK_URL?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/api/tesla/telemetry`;
  }

  return null;
}

export function getTelemetryWebhookSecret(): string | null {
  return process.env.TESLA_TELEMETRY_WEBHOOK_SECRET ?? null;
}

export function getTelemetryStaleAfterMs(): number {
  const seconds = Number(process.env.TESLA_TELEMETRY_STALE_AFTER_SECONDS ?? "300");
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 5 * 60 * 1000;
  }
  return seconds * 1000;
}

export function getTelemetryFreshnessMs(): number {
  const seconds = Number(process.env.TESLA_TELEMETRY_FRESHNESS_SECONDS ?? "120");
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 2 * 60 * 1000;
  }
  return seconds * 1000;
}

export function getTelemetryProcessBatchSize(): number {
  const size = Number(process.env.TESLA_TELEMETRY_PROCESS_BATCH_SIZE ?? "50");
  if (!Number.isFinite(size) || size <= 0) {
    return 50;
  }
  return Math.min(size, 200);
}

export function getPartnerToken(): string | null {
  const value = process.env.TESLA_PARTNER_TOKEN?.trim();
  return value ? value : null;
}

/** Vehicle Command Proxy base (예: https://localhost:4443). config create 서명에 필요 */
export function getVehicleCommandProxyUrl(): string | null {
  const value = process.env.TESLA_VEHICLE_COMMAND_PROXY_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

/** fleet_telemetry_config.hostname — 기본 telemetry.bori-fleet.shop */
export function getTelemetryPublicHost(): string {
  return (
    process.env.TELEMETRY_PUBLIC_HOST?.trim() ||
    process.env.TESLA_TELEMETRY_HOSTNAME?.trim() ||
    "telemetry.bori-fleet.shop"
  );
}

/** Fly Telemetry 서버와 동일 CA (PEM). 재구독 create에 필요 */
export function getTelemetryCaPem(): string | null {
  const raw =
    process.env.TESLA_TELEMETRY_CA_PEM?.trim() ||
    process.env.TELEMETRY_CA_PEM?.trim() ||
    null;
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/** ASLEEP→ONLINE 시 vehicle_data 쿨다운(분). 기본 30 */
export function getRestWakeCooldownMinutes(): number {
  const minutes = Number(process.env.TESLA_REST_WAKE_COOLDOWN_MINUTES ?? "30");
  if (!Number.isFinite(minutes) || minutes < 0) {
    return 30;
  }
  return minutes;
}

/** READY/VK 확인 후 Baseline vehicle_data 1회 시도. 기본 true */
export function isBaselineOnReadyEnabled(): boolean {
  const value = process.env.TESLA_BASELINE_ON_READY;
  if (value === "false" || value === "0") {
    return false;
  }
  return true;
}

/**
 * 차량 상세 Telemetry payload 모니터(개발용).
 * `NEXT_PUBLIC_TELEMETRY_VALUE_MONITOR` / `TELEMETRY_VALUE_MONITOR`
 * — true/1 강제 ON, false/0 강제 OFF, 미설정 시 non-production만 ON.
 */
export function isTelemetryValueMonitorEnabled(): boolean {
  const value =
    process.env.NEXT_PUBLIC_TELEMETRY_VALUE_MONITOR?.trim() ||
    process.env.TELEMETRY_VALUE_MONITOR?.trim();
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}
