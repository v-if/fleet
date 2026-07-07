import { NextResponse } from "next/server";

import { disconnectTeslaAccount, getStoredTeslaToken, isTeslaConnected } from "@/lib/tesla/auth";
import { isTeslaConfigured } from "@/lib/tesla/config";
import { getSyncMetadata } from "@/lib/vehicle-sync";
import { getVehicleProviderName } from "@/lib/vehicle-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const [connected, token, syncMetadata] = await Promise.all([
    isTeslaConnected(),
    getStoredTeslaToken(),
    getSyncMetadata(),
  ]);

  return NextResponse.json({
    configured: isTeslaConfigured(),
    connected,
    provider: getVehicleProviderName(),
    scope: token?.scope ?? null,
    expiresAt: token?.expiresAt.toISOString() ?? null,
    sync: syncMetadata
      ? {
          lastSyncedAt: syncMetadata.lastSyncedAt?.toISOString() ?? null,
          provider: syncMetadata.provider,
          usedFallback: syncMetadata.usedFallback,
          lastError: syncMetadata.lastError,
        }
      : null,
  });
}

export async function DELETE() {
  await disconnectTeslaAccount();
  return NextResponse.json({ connected: false });
}
