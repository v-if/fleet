import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { getVehiclesResponse } from "@/lib/vehicles";
import { shouldAutoSync, syncVehiclesFromProvider } from "@/lib/vehicle-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  if (forceRefresh || (await shouldAutoSync())) {
    try {
      await syncVehiclesFromProvider(session.userId);
    } catch (error) {
      console.error("Vehicle sync failed:", error);
    }
  }

  const data = await getVehiclesResponse();
  return NextResponse.json(data);
}
