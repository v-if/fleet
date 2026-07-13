import { prisma } from "@/lib/prisma";

import { extractTelemetryMessages } from "./mapper";
import type { TelemetryFieldValue } from "./types";

export const TELEMETRY_MONITOR_LINE_LIMIT = 20;
const INGRESS_FETCH_LIMIT = 40;

export type TelemetryMonitorLineDto = {
  displayAt: string;
  field: string;
  value: string;
  text: string;
  ingressId: string;
  occurredAt: string;
};

/** Asia/Seoul → `MM-DD HH:mm:ss` */
export function formatMonitorTimestampKst(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function formatTelemetryFieldPlain(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const field = value as TelemetryFieldValue;
  if (field.stringValue != null) return field.stringValue;
  if (field.booleanValue != null) return String(field.booleanValue);
  if (field.doubleValue != null) return String(field.doubleValue);
  if (field.intValue != null) return String(field.intValue);
  if (field.longValue != null) return String(field.longValue);
  if (field.shiftStateValue != null) return String(field.shiftStateValue);
  if (field.chargingValue != null) return String(field.chargingValue);
  if (field.sentryModeStateValue != null) return String(field.sentryModeStateValue);
  if (field.hvacPowerValue != null) return String(field.hvacPowerValue);
  if (field.windowStateValue != null) return String(field.windowStateValue);
  if (field.locationValue) {
    const lat = field.locationValue.latitude;
    const lng = field.locationValue.longitude;
    if (lat != null && lng != null) {
      return `${lat.toFixed(5)},${lng.toFixed(5)}`;
    }
    return "location";
  }
  if (field.doorValue) {
    return Object.entries(field.doorValue)
      .filter(([, open]) => open === true)
      .map(([key]) => key)
      .join(",") || "closed";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[unreadable]";
  }
}

function messageEventAt(message: {
  createdAt?: string;
  timestamp?: string | number;
}): Date {
  const raw = message.createdAt ?? message.timestamp;
  if (typeof raw === "number") {
    const millis = raw > 1_000_000_000_000 ? raw : raw * 1000;
    return new Date(millis);
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/** ingress payload → 최신순 필드 줄 (상한까지) */
export function expandIngressPayloadToMonitorLines(
  ingressId: string,
  payload: unknown,
  receivedAt: Date,
  lineLimit: number,
): TelemetryMonitorLineDto[] {
  const lines: TelemetryMonitorLineDto[] = [];
  const messages = extractTelemetryMessages(payload);

  for (const message of messages) {
    const data = message.data;
    if (!data || typeof data !== "object") continue;

    const occurredAt = messageEventAt(message);
    const displayAt = formatMonitorTimestampKst(
      Number.isNaN(occurredAt.getTime()) ? receivedAt : occurredAt,
    );

    for (const [field, raw] of Object.entries(data)) {
      if (lines.length >= lineLimit) return lines;
      const value = formatTelemetryFieldPlain(raw);
      lines.push({
        displayAt,
        field,
        value,
        text: `${displayAt} ${field} ${value}`,
        ingressId,
        occurredAt: occurredAt.toISOString(),
      });
    }
  }

  return lines;
}

export async function listTelemetryMonitorLinesForVehicle(input: {
  vehicleId: string;
  vin?: string | null;
  lineLimit?: number;
}): Promise<TelemetryMonitorLineDto[]> {
  const lineLimit = input.lineLimit ?? TELEMETRY_MONITOR_LINE_LIMIT;
  const vin = input.vin?.trim().toUpperCase() || null;

  const rows = await prisma.telemetryIngress.findMany({
    where: {
      OR: [
        { vehicleId: input.vehicleId },
        ...(vin ? [{ vin }] : []),
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: INGRESS_FETCH_LIMIT,
    select: {
      id: true,
      payload: true,
      receivedAt: true,
    },
  });

  const lines: TelemetryMonitorLineDto[] = [];
  for (const row of rows) {
    if (lines.length >= lineLimit) break;
    const remaining = lineLimit - lines.length;
    lines.push(
      ...expandIngressPayloadToMonitorLines(
        row.id,
        row.payload,
        row.receivedAt,
        remaining,
      ),
    );
  }

  return lines;
}
