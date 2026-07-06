import { NextResponse } from "next/server";

import { getVehicleDetail } from "@/lib/vehicles";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const vehicle = await getVehicleDetail(id);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({
    provider: process.env.VEHICLE_DATA_PROVIDER ?? "mock",
    vehicle,
  });
}
