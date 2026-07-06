import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 3,
      },
    },
    orderBy: { plateNumber: "asc" },
  });

  const payload = vehicles.map((vehicle) => ({
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    model: vehicle.model,
    year: vehicle.year,
    snapshot: vehicle.snapshots[0] ?? null,
    recentEvents: vehicle.events,
  }));

  return NextResponse.json({
    provider: process.env.VEHICLE_DATA_PROVIDER ?? "mock",
    count: payload.length,
    vehicles: payload,
  });
}
