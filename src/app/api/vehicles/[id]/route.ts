import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { getVehicleDetail } from "@/lib/vehicles";
import { isTelemetryPrimaryMode } from "@/lib/tesla/telemetry/config";
import { inferAsleepVehicles } from "@/lib/tesla/telemetry/processor";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * 차량 상세.
 * Phase AS-H (Hobby): Telemetry primary 시 inferAsleepVehicles — 안 1
 * (목록과 동일 side-effect로 주차(절전)/ONLINE 정합).
 * Pro(안 2)에서는 Cron SoT 후 본 블록 제거 (AS-6).
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  if (isTelemetryPrimaryMode()) {
    try {
      await inferAsleepVehicles();
    } catch (error) {
      console.warn("Telemetry asleep inference failed:", error);
    }
  }

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
