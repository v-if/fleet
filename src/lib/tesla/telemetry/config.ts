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
  return process.env.TESLA_PARTNER_TOKEN ?? null;
}
