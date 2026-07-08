import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth-session";
import { getSyncCronSecret } from "@/lib/tesla/config";
import { syncVehiclesFromProvider } from "@/lib/vehicle-sync";

function isAuthorized(request: Request) {
  const secret = getSyncCronSecret();
  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncVehiclesFromProvider(session?.userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
