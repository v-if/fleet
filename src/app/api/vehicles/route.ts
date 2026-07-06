import { NextResponse } from "next/server";

import { getVehiclesResponse } from "@/lib/vehicles";

export async function GET() {
  const data = await getVehiclesResponse();
  return NextResponse.json(data);
}
