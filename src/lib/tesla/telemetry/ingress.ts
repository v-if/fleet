import { TelemetryIngressStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildIngressIdempotencyKey } from "./mapper";

export type SaveTelemetryIngressResult = {
  id: string;
  duplicate: boolean;
  status: TelemetryIngressStatus;
};

export async function saveTelemetryIngress(
  payload: unknown,
  options: {
    idempotencyKey?: string | null;
    vin?: string | null;
    vehicleId?: string | null;
  } = {},
): Promise<SaveTelemetryIngressResult> {
  const idempotencyKey = buildIngressIdempotencyKey(payload, options.idempotencyKey);

  const existing = await prisma.telemetryIngress.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  });

  if (existing) {
    return {
      id: existing.id,
      duplicate: true,
      status: TelemetryIngressStatus.DUPLICATE,
    };
  }

  const created = await prisma.telemetryIngress.create({
    data: {
      idempotencyKey,
      vin: options.vin ?? null,
      vehicleId: options.vehicleId ?? null,
      payload: payload as object,
      status: TelemetryIngressStatus.PENDING,
    },
  });

  await prisma.telemetryMetadata.upsert({
    where: { id: "default" },
    update: {
      lastReceivedAt: new Date(),
      pendingIngressCount: { increment: 1 },
      lastError: null,
    },
    create: {
      id: "default",
      lastReceivedAt: new Date(),
      pendingIngressCount: 1,
    },
  });

  return {
    id: created.id,
    duplicate: false,
    status: TelemetryIngressStatus.PENDING,
  };
}

export async function refreshTelemetryMetadataCounts() {
  const [pendingIngressCount, subscriptionCount] = await Promise.all([
    prisma.telemetryIngress.count({
      where: { status: TelemetryIngressStatus.PENDING },
    }),
    prisma.telemetrySubscription.count({
      where: { active: true },
    }),
  ]);

  await prisma.telemetryMetadata.upsert({
    where: { id: "default" },
    update: {
      pendingIngressCount,
      subscriptionCount,
    },
    create: {
      id: "default",
      pendingIngressCount,
      subscriptionCount,
    },
  });
}

export async function getTelemetryMetadata() {
  return prisma.telemetryMetadata.findUnique({
    where: { id: "default" },
  });
}
