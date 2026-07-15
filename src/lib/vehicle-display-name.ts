import { ApiCallDirection, AuditLogStatus } from "@prisma/client";

import { createAuditLogWithApiCall, sanitizeBody } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import { getVehicleDetail } from "@/lib/vehicles";

export const VEHICLE_DISPLAY_NAME_MAX = 32;

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;

export function normalizeVehicleDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > VEHICLE_DISPLAY_NAME_MAX) return null;
  if (CONTROL_CHAR_REGEX.test(trimmed)) return null;
  return trimmed;
}

export function shouldPreservePlateNumber(
  plateNumberEditedAt: Date | null | undefined,
): boolean {
  return plateNumberEditedAt != null;
}

/** REST/registry 갱신 시 수동 표시명이면 plateNumber 필드 제외 */
export function withoutPlateNumberIfPreserved<
  T extends { plateNumber?: string },
>(data: T, preserve: boolean): Omit<T, "plateNumber"> | T {
  if (!preserve) return data;
  const { plateNumber: _removed, ...rest } = data;
  return rest;
}

export type UpdateVehicleDisplayNameResult =
  | { ok: true; vehicle: NonNullable<Awaited<ReturnType<typeof getVehicleDetail>>> }
  | { ok: false; error: string; status: number };

export async function updateVehicleDisplayName(
  vehicleId: string,
  rawPlateNumber: unknown,
  actor: { userId: string; email: string },
  audit?: { requestId: string; method: string; url: string; path: string },
): Promise<UpdateVehicleDisplayNameResult> {
  const normalized = normalizeVehicleDisplayName(rawPlateNumber);
  if (!normalized) {
    return {
      ok: false,
      error: `표시명은 1~${VEHICLE_DISPLAY_NAME_MAX}자여야 합니다.`,
      status: 400,
    };
  }

  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...activeVehicleWhere },
    select: { id: true, plateNumber: true, plateNumberEditedAt: true },
  });

  if (!existing) {
    return { ok: false, error: "Vehicle not found", status: 404 };
  }

  if (existing.plateNumber === normalized) {
    const vehicle = await getVehicleDetail(vehicleId);
    if (!vehicle) {
      return { ok: false, error: "Vehicle not found", status: 404 };
    }
    return { ok: true, vehicle };
  }

  const duplicate = await prisma.vehicle.findFirst({
    where: {
      plateNumber: normalized,
      id: { not: vehicleId },
      ...activeVehicleWhere,
    },
    select: { id: true },
  });

  if (duplicate) {
    return { ok: false, error: "이미 사용 중인 표시명입니다.", status: 409 };
  }

  const previousPlateNumber = existing.plateNumber;

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      plateNumber: normalized,
      plateNumberEditedAt: existing.plateNumberEditedAt ?? new Date(),
    },
  });

  const vehicle = await getVehicleDetail(vehicleId);
  if (!vehicle) {
    return { ok: false, error: "Vehicle not found", status: 404 };
  }

  if (audit) {
    await createAuditLogWithApiCall(
      {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "vehicle.display_name_update",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        requestId: audit.requestId,
        status: AuditLogStatus.SUCCESS,
        summary: `차량 표시명 변경: ${previousPlateNumber} → ${normalized}`,
        metadata: sanitizeBody({
          before: previousPlateNumber,
          after: normalized,
        }),
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId: audit.requestId,
        actorUserId: actor.userId,
        vehicleId,
        method: audit.method,
        url: audit.url,
        path: audit.path,
        statusCode: 200,
        success: true,
        requestBody: sanitizeBody({ plateNumber: normalized }),
        responseBody: sanitizeBody({ plateNumber: normalized }),
      },
    );
  }

  return { ok: true, vehicle };
}
