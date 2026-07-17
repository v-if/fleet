import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  listActivitySessions,
  summarizeVehicleActivity,
} from "@/lib/vehicle-activity-session";
import { activeVehicleWhere } from "@/lib/vehicle-query";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/**
 * VD3-H: 차량 주행·충전 히스토리
 * GET /api/vehicles/[id]/activity?kind=all|drive|charge&from=&to=&limit=
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
  const kindRaw = (url.searchParams.get("kind") ?? "all").toLowerCase();
  const kind =
    kindRaw === "drive" || kindRaw === "charge" || kindRaw === "all"
      ? kindRaw
      : "all";

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const limitParam = url.searchParams.get("limit");

  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "Invalid from" }, { status: 400 });
  }
  if (to && Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid to" }, { status: 400 });
  }

  const limit = limitParam ? Number(limitParam) : undefined;
  if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const result = await listActivitySessions({
    vehicleId,
    kind,
    from,
    to,
    limit,
  });

  const summary = await summarizeVehicleActivity(vehicleId);

  return NextResponse.json({
    vehicleId,
    kind,
    ...result,
    summary,
    notice: "Telemetry 기반 추정 이력입니다. 신호 공백 시 거리·충전량이 과소할 수 있습니다.",
  });
}
