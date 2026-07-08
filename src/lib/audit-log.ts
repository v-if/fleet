import { randomUUID } from "node:crypto";

import { ApiCallDirection, AuditLogStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SENSITIVE_KEYS = new Set([
  "authorization",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "cookie",
  "set-cookie",
  "x-session-signature",
]);

const MAX_STRING_LENGTH = 4_000;
const MAX_JSON_LENGTH = 16_000;

type JsonValue = Prisma.JsonValue;

export type CreateAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  vehicleId?: string | null;
  teslaAccountId?: string | null;
  requestId?: string | null;
  status: AuditLogStatus;
  summary: string;
  metadata?: JsonValue | null;
};

export type CreateApiCallLogInput = {
  direction: ApiCallDirection;
  system: string;
  requestId?: string | null;
  auditLogId?: string | null;
  actorUserId?: string | null;
  teslaAccountId?: string | null;
  vehicleId?: string | null;
  method: string;
  url: string;
  path?: string | null;
  statusCode?: number | null;
  success: boolean;
  durationMs?: number | null;
  requestHeaders?: JsonValue | null;
  requestBody?: JsonValue | null;
  responseHeaders?: JsonValue | null;
  responseBody?: JsonValue | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

function truncateString(value: string) {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}... [truncated]`
    : value;
}

function sanitizeStringValue(value: string, key?: string) {
  if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }

  if (/^bearer\s+/i.test(value)) {
    return "Bearer [REDACTED]";
  }

  return truncateString(value);
}

function sanitizeValue(value: unknown, key?: string): JsonValue {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeStringValue(value, key);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
      return "[REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)) as JsonValue;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey),
    ]);
    return Object.fromEntries(entries) as JsonValue;
  }

  return truncateString(String(value));
}

function normalizeBody(body: unknown): JsonValue | null {
  if (body == null) return null;

  const sanitized = sanitizeValue(body);
  const serialized = JSON.stringify(sanitized);
  if (serialized.length <= MAX_JSON_LENGTH) {
    return sanitized;
  }

  return {
    truncated: true,
    preview: truncateString(serialized.slice(0, MAX_JSON_LENGTH)),
  };
}

export function createRequestId() {
  return randomUUID();
}

export function getOrCreateRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? createRequestId();
}

export function sanitizeHeaders(headers: HeadersInit | undefined): JsonValue | null {
  if (!headers) return null;

  const normalized = new Headers(headers);
  return normalizeBody(Object.fromEntries(normalized.entries()));
}

export function sanitizeBody(body: unknown): JsonValue | null {
  return normalizeBody(body);
}

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      vehicleId: input.vehicleId ?? null,
      teslaAccountId: input.teslaAccountId ?? null,
      requestId: input.requestId ?? null,
      status: input.status,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function createApiCallLog(input: CreateApiCallLogInput) {
  return prisma.apiCallLog.create({
    data: {
      direction: input.direction,
      system: input.system,
      requestId: input.requestId ?? null,
      auditLogId: input.auditLogId ?? null,
      actorUserId: input.actorUserId ?? null,
      teslaAccountId: input.teslaAccountId ?? null,
      vehicleId: input.vehicleId ?? null,
      method: input.method,
      url: truncateString(input.url),
      path: input.path ?? null,
      statusCode: input.statusCode ?? null,
      success: input.success,
      durationMs: input.durationMs ?? null,
      requestHeaders: input.requestHeaders ?? undefined,
      requestBody: input.requestBody ?? undefined,
      responseHeaders: input.responseHeaders ?? undefined,
      responseBody: input.responseBody ?? undefined,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ? truncateString(input.errorMessage) : null,
    },
  });
}

export async function createAuditLogWithApiCall(
  audit: CreateAuditLogInput,
  apiCall: Omit<CreateApiCallLogInput, "auditLogId">,
) {
  const createdAudit = await createAuditLog(audit);
  await createApiCallLog({
    ...apiCall,
    auditLogId: createdAudit.id,
  });
  return createdAudit;
}
