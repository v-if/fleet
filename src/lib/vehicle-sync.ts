import { prisma } from "@/lib/prisma";
import {
  createVehicleProvider,
  getMockVehicleEvents,
  getVehicleProviderName,
  MockVehicleProvider,
} from "@/lib/vehicle-providers";
import type { VehicleEventData, VehicleSnapshotData } from "@/lib/vehicle-providers/types";
import { TeslaVehicleProvider } from "@/lib/vehicle-providers/tesla-provider";

export type SyncVehiclesResult = {
  provider: string;
  usedFallback: boolean;
  vehicleCount: number;
  eventCount: number;
  lastSyncedAt: string;
  error?: string;
};

async function upsertSnapshot(snapshot: VehicleSnapshotData) {
  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: snapshot.plateNumber },
    update: {
      model: snapshot.model,
      year: snapshot.year,
      oemVehicleId: snapshot.oemVehicleId,
    },
    create: {
      plateNumber: snapshot.plateNumber,
      model: snapshot.model,
      year: snapshot.year,
      oemVehicleId: snapshot.oemVehicleId,
    },
  });

  await prisma.vehicleSnapshot.create({
    data: {
      vehicleId: vehicle.id,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      batteryPercent: snapshot.batteryPercent,
      rangeKm: snapshot.rangeKm,
      ignitionOn: snapshot.ignitionOn,
      status: snapshot.status,
      chargingStatus: snapshot.chargingStatus,
      odometerKm: snapshot.odometerKm,
      locked: snapshot.locked,
      doorsOpen: snapshot.doorsOpen,
      windowsOpen: snapshot.windowsOpen,
      insideTempC: snapshot.insideTempC,
      outsideTempC: snapshot.outsideTempC,
      climateOn: snapshot.climateOn,
      tpmsFrontLeft: snapshot.tpmsFrontLeft,
      tpmsFrontRight: snapshot.tpmsFrontRight,
      tpmsRearLeft: snapshot.tpmsRearLeft,
      tpmsRearRight: snapshot.tpmsRearRight,
      sentryMode: snapshot.sentryMode,
      serviceStatus: snapshot.serviceStatus,
      softwareVersion: snapshot.softwareVersion,
      nearbyChargingSites: snapshot.nearbyChargingSites
        ? JSON.stringify(snapshot.nearbyChargingSites)
        : null,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    },
  });

  return vehicle;
}

async function replaceEvents(events: VehicleEventData[]) {
  await prisma.vehicleEvent.deleteMany();

  for (const event of events) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: event.plateNumber },
    });
    if (!vehicle) continue;

    await prisma.vehicleEvent.create({
      data: {
        vehicleId: vehicle.id,
        type: event.type,
        message: event.message,
        occurredAt: event.occurredAt,
      },
    });
  }
}

async function fetchProviderEvents(providerName: string) {
  if (providerName === "tesla") {
    const teslaProvider = new TeslaVehicleProvider();
    return teslaProvider.fetchVehicleEvents();
  }
  return getMockVehicleEvents();
}

export async function syncVehiclesFromProvider(): Promise<SyncVehiclesResult> {
  const requestedProvider = getVehicleProviderName();
  let provider = createVehicleProvider();
  let usedFallback = false;
  let errorMessage: string | undefined;

  let snapshots: VehicleSnapshotData[] = [];

  try {
    snapshots = await provider.fetchVehicles();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown sync error";

    if (requestedProvider === "tesla") {
      usedFallback = true;
      provider = new MockVehicleProvider();
      snapshots = await provider.fetchVehicles();
    } else {
      throw error;
    }
  }

  await prisma.vehicleSnapshot.deleteMany();

  for (const snapshot of snapshots) {
    await upsertSnapshot(snapshot);
  }

  let events: VehicleEventData[] = [];
  try {
    events = await fetchProviderEvents(usedFallback ? "mock" : provider.name);
  } catch (error) {
    console.warn("Failed to fetch provider events:", error);
    events = getMockVehicleEvents();
  }

  await replaceEvents(events);

  const lastSyncedAt = new Date();

  await prisma.syncMetadata.upsert({
    where: { id: "default" },
    update: {
      lastSyncedAt,
      provider: usedFallback ? "mock" : provider.name,
      usedFallback,
      lastError: errorMessage ?? null,
    },
    create: {
      id: "default",
      lastSyncedAt,
      provider: usedFallback ? "mock" : provider.name,
      usedFallback,
      lastError: errorMessage ?? null,
    },
  });

  return {
    provider: usedFallback ? "mock" : provider.name,
    usedFallback,
    vehicleCount: snapshots.length,
    eventCount: events.length,
    lastSyncedAt: lastSyncedAt.toISOString(),
    error: errorMessage,
  };
}

export async function getSyncMetadata() {
  return prisma.syncMetadata.findUnique({
    where: { id: "default" },
  });
}

export async function shouldAutoSync() {
  const metadata = await getSyncMetadata();
  if (!metadata?.lastSyncedAt) {
    return true;
  }

  const { getSyncPollIntervalMs } = await import("@/lib/tesla/config");
  return Date.now() - metadata.lastSyncedAt.getTime() >= getSyncPollIntervalMs();
}
