import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { getVehiclesResponse } from "@/lib/vehicles";
import { isTelemetryPrimaryMode } from "@/lib/tesla/telemetry/config";
import { inferAsleepVehicles } from "@/lib/tesla/telemetry/processor";
import { shouldAutoSync, syncVehiclesFromProvider } from "@/lib/vehicle-sync";

export const dynamic = "force-dynamic";

/**
 * 차량 목록.
 * Phase AS-H (Hobby): Telemetry primary 시 inferAsleepVehicles — 안 1.
 * Pro(안 2)에서는 Cron SoT로 옮기고 본 블록을 제거한다 (AS-5).
 */
export async function GET(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const forceFallback = searchParams.get("fallback") === "1";
  const scope = searchParams.get("scope") === "all" ? "all" : "fleet";

  if (forceRefresh || (await shouldAutoSync())) {
    try {
      await syncVehiclesFromProvider(session.userId, {
        forceFallback,
        mode: forceFallback ? "full" : "auto",
      });
    } catch (error) {
      console.error("Vehicle sync failed:", error);
    }
  }

  if (isTelemetryPrimaryMode()) {
    try {
      await inferAsleepVehicles();
    } catch (error) {
      console.warn("Telemetry asleep inference failed:", error);
    }
  }

  const data = await getVehiclesResponse({ scope });
  return NextResponse.json(data);
}
