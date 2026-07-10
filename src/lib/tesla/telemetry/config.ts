export function isTelemetryEnabled(): boolean {
  const value = process.env.TESLA_TELEMETRY_ENABLED;
  if (value === "false" || value === "0") {
    return false;
  }
  return true;
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
