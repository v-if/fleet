import { NextResponse } from "next/server";

import { getVehiclesResponse } from "@/lib/vehicles";
import { shouldAutoSync, syncVehiclesFromProvider } from "@/lib/vehicle-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  if (forceRefresh || (await shouldAutoSync())) {
    try {
      await syncVehiclesFromProvider();
    } catch (error) {
      console.error("Vehicle sync failed:", error);
    }
  }

  const data = await getVehiclesResponse();
  return NextResponse.json(data);
}
