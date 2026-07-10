import { NextResponse } from "next/server";

import { getSyncCronSecret } from "@/lib/tesla/config";
import { getTelemetryOperationalStatus } from "@/lib/tesla/telemetry/status";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = getSyncCronSecret();
  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getTelemetryOperationalStatus();
  return NextResponse.json(status);
}
