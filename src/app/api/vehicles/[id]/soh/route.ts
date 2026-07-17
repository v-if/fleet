import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getVehicleSohSummary } from "@/lib/vehicle-soh";
import { activeVehicleWhere } from "@/lib/vehicle-query";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/**
 * VD3-SOH: 충전 한도 도달 시 잔여 km 추이
 * GET /api/vehicles/[id]/soh?from=&to=
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id: vehicleId } = await context.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      ...activeVehicleWhere,
      teslaAccount: { userId: session.userId },
    },
    select: { id: true },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "Invalid from" }, { status: 400 });
  }
  if (to && Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid to" }, { status: 400 });
  }

  const summary = await getVehicleSohSummary(vehicleId, { from, to });

  return NextResponse.json({
    vehicleId,
    ...summary,
  });
}
