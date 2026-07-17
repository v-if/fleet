import {
  ApiCallDirection,
  AuditLogStatus,
  ChargingStatus,
  EventType,
  ServiceStatus,
  TeslaAccountRole,
  VehicleLifecycle,
  RestSyncReason,
  VehicleStatus,
} from "@prisma/client";

import { createAuditLogWithApiCall } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { serializeNearbyChargingSites } from "@/lib/tesla/nearby-charging";

const SEOUL_BOUNDS = {
  minLat: 37.42,
  maxLat: 37.68,
  minLng: 126.82,
  maxLng: 127.18,
};

const MODEL_OPTIONS = [
  { carType: "model3", label: "Tesla Model 3", trim: "rwd" },
  { carType: "model3", label: "Tesla Model 3", trim: "longrange" },
  { carType: "modely", label: "Tesla Model Y", trim: "longrange" },
  { carType: "modely", label: "Tesla Model Y", trim: "performance" },
] as const;

const SOFTWARE_VERSIONS = ["2024.14.30", "2024.20.7", "2024.26.8", "2024.38.12", "2024.44.25"];

const ALERT_MESSAGES = [
  { type: "WARNING" as EventType, message: "추가 설명 텍스트: 배터리 잔량이 낮습니다." },
  { type: "OFFLINE" as EventType, message: "추가 설명 텍스트: 차량이 절전 상태입니다." },
  { type: "WARNING" as EventType, message: "추가 설명 텍스트: 창문이 열려 있습니다." },
  { type: "ALERT" as EventType, message: "추가 설명 텍스트: 타이어 공기압 이상이 감지되었습니다." },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, digits = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(digits));
}

function pickOne<T>(items: readonly T[]) {
  return items[randomInt(0, items.length - 1)];
}

function randomPlateNumber() {
  const first = randomInt(10, 99);
  const middle = pickOne(["가", "나", "다", "라", "마", "바", "사", "아", "자"]);
  const last = randomInt(1000, 9999);
  return `${first}${middle}${last}`;
}

function randomVin(index: number) {
  const suffix = `${Date.now()}`.slice(-6);
  return `5YJ${randomInt(100000, 999999)}VIRTUAL${index}${suffix}`.slice(0, 17);
}

function randomCoordinates() {
  return {
    latitude: randomFloat(SEOUL_BOUNDS.minLat, SEOUL_BOUNDS.maxLat, 6),
    longitude: randomFloat(SEOUL_BOUNDS.minLng, SEOUL_BOUNDS.maxLng, 6),
  };
}

function randomStatus(batteryPercent: number): VehicleStatus {
  if (batteryPercent < 15) return "ALERT";
  if (batteryPercent < 25) return "WARNING";
  return pickOne(["ONLINE", "ONLINE", "ONLINE", "OFFLINE", "WARNING"] as const);
}

function randomChargingStatus(batteryPercent: number): ChargingStatus {
  if (batteryPercent > 90) return pickOne(["COMPLETE", "DISCONNECTED"] as const);
  return pickOne(["CHARGING", "DISCONNECTED", "STOPPED", "DISCONNECTED"] as const);
}

function randomServiceStatus(): ServiceStatus {
  return pickOne(["OK", "OK", "OK", "DUE_SOON", "IN_SERVICE"] as const);
}

function randomNearbyChargingSites(originLat: number, originLng: number) {
  const count = randomInt(0, 2);
  return Array.from({ length: count }, (_, index) => ({
    name: `Supercharger ${index + 1}`,
    distanceKm: randomFloat(0.5, 8.5, 1),
    latitude: originLat + (Math.random() - 0.5) * 0.04,
    longitude: originLng + (Math.random() - 0.5) * 0.04,
    siteType: "supercharger" as const,
  }));
}

function randomEmail() {
  return `seed-${Date.now()}-${randomInt(100, 999)}@virtual.tesla.local`;
}

type CreateVirtualVehiclesInput = {
  userId: string;
  userEmail: string | null;
  requestId?: string | null;
};

export async function createVirtualTeslaAccountWithVehicles(input: CreateVirtualVehiclesInput) {
  const vehicleCount = randomInt(1, 5);
  const teslaEmail = randomEmail();
  const seedTimestamp = Date.now();
  const vehicleSeeds = Array.from({ length: vehicleCount }, (_, index) => {
    const modelOption = pickOne(MODEL_OPTIONS);
    const batteryPercent = randomInt(10, 95);
    const chargingStatus = randomChargingStatus(batteryPercent);
    const status = randomStatus(batteryPercent);
    const coordinates = randomCoordinates();
    const locked = pickOne([true, true, true, false]);
    const doorsOpen = locked ? false : pickOne([true, false]);
    const windowsOpen = pickOne([false, false, true]);
    const climateOn = pickOne([true, false]);
    const sentryMode = pickOne([true, false, false]);
    const eventCount = randomInt(0, 2);

    return {
      plateNumber: randomPlateNumber(),
      model: modelOption.label,
      year: randomInt(2021, 2026),
      oemVehicleId: randomVin(index + 1),
      carType: modelOption.carType,
      trimBadging: modelOption.trim,
      exteriorColor: pickOne(["SolidBlack", "PearlWhite", "DeepBlueMetallic", "RedMultiCoat"]),
      teslaDisplayName: modelOption.label,
      snapshot: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        batteryPercent,
        rangeKm: randomInt(90, 520),
        ignitionOn: pickOne([true, false, false]),
        shiftState: pickOne(["P", "P", "D", "R", "N"]),
        chargerPowerKw: pickOne([null, 6.3, 11, 48]),
        chargingPowerKind: pickOne([null, "AC", "AC", "DC"]),
        status,
        chargingStatus,
        odometerKm: randomInt(3000, 45000),
        locked,
        doorsOpen,
        windowsOpen,
        insideTempC: randomFloat(18, 38, 1),
        outsideTempC: randomFloat(15, 36, 1),
        climateOn,
        tpmsFrontLeft: randomFloat(2.8, 3.2, 2),
        tpmsFrontRight: randomFloat(2.8, 3.2, 2),
        tpmsRearLeft: randomFloat(2.8, 3.2, 2),
        tpmsRearRight: randomFloat(2.8, 3.2, 2),
        sentryMode,
        serviceStatus: randomServiceStatus(),
        softwareVersion: pickOne(SOFTWARE_VERSIONS),
        nearbyChargingSites: serializeNearbyChargingSites(
          randomNearbyChargingSites(coordinates.latitude, coordinates.longitude),
          {
            capturedAt: new Date(),
            capturedLat: coordinates.latitude,
            capturedLng: coordinates.longitude,
          },
        ),
        lastUpdatedAt: new Date(),
      },
      events: Array.from({ length: eventCount }, () => {
        const alert = pickOne(ALERT_MESSAGES);
        return {
          type: alert.type,
          message: alert.message,
          occurredAt: new Date(Date.now() - randomInt(5, 120) * 60 * 1000),
        };
      }),
    };
  });

  const account = await prisma.teslaAccount.create({
    data: {
      userId: input.userId,
      teslaEmail,
      region: "na",
      accessToken: `virtual-access-${seedTimestamp}-${randomInt(1000, 9999)}`,
      refreshToken: `virtual-refresh-${seedTimestamp}-${randomInt(1000, 9999)}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      scope: "virtual vehicle_device_data vehicle_location",
      role: TeslaAccountRole.OWNER,
      vehicles: {
        create: vehicleSeeds.map((vehicleSeed) => ({
          plateNumber: vehicleSeed.plateNumber,
          model: vehicleSeed.model,
          year: vehicleSeed.year,
          oemVehicleId: vehicleSeed.oemVehicleId,
          carType: vehicleSeed.carType,
          trimBadging: vehicleSeed.trimBadging,
          exteriorColor: vehicleSeed.exteriorColor,
          teslaDisplayName: vehicleSeed.teslaDisplayName,
          specsSyncedAt: new Date(),
          syncState: {
            create: {
              lifecycle: VehicleLifecycle.READY,
              baselineCompletedAt: new Date(),
              lastRestSyncAt: new Date(),
              lastRestSyncReason: RestSyncReason.BASELINE,
            },
          },
          snapshots: {
            create: [vehicleSeed.snapshot],
          },
          events: {
            create: vehicleSeed.events,
          },
        })),
      },
    },
    select: {
      id: true,
      teslaEmail: true,
    },
  });

  const createdVehicles = await prisma.vehicle.findMany({
    where: {
      teslaAccountId: account.id,
    },
    select: {
      id: true,
      plateNumber: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // VD3-H: 데모용 샘플 주행·충전 세션
  const now = Date.now();
  for (const vehicle of createdVehicles) {
    await prisma.vehicleActivitySession.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          kind: "DRIVE",
          startedAt: new Date(now - 5 * 60 * 60 * 1000),
          endedAt: new Date(now - 4.5 * 60 * 60 * 1000),
          startOdometerKm: 12000,
          endOdometerKm: 12012.4,
          distanceKm: 12.4,
          startBatteryPercent: 72,
          endBatteryPercent: 65,
          source: "DERIVED",
        },
        {
          vehicleId: vehicle.id,
          kind: "CHARGE",
          startedAt: new Date(now - 4 * 60 * 60 * 1000),
          endedAt: new Date(now - 2.5 * 60 * 60 * 1000),
          startBatteryPercent: 42,
          endBatteryPercent: 78,
          energyAddedPercent: 36,
          chargingPowerKind: "AC",
          peakChargerPowerKw: 7.2,
          source: "DERIVED",
        },
        {
          vehicleId: vehicle.id,
          kind: "DRIVE",
          startedAt: new Date(now - 90 * 60 * 1000),
          endedAt: new Date(now - 55 * 60 * 1000),
          startOdometerKm: 12012.4,
          endOdometerKm: 12015.5,
          distanceKm: 3.1,
          startBatteryPercent: 78,
          endBatteryPercent: 75,
          source: "DERIVED",
        },
      ],
    });
  }

  const result = {
    accountId: account.id,
    teslaEmail: account.teslaEmail,
    vehicleCount,
    vehicles: createdVehicles,
  };

  await createAuditLogWithApiCall(
    {
      actorUserId: input.userId,
      actorEmail: input.userEmail,
      action: "VIRTUAL_VEHICLE_SEED",
      targetType: "TeslaAccount",
      targetId: result.accountId,
      teslaAccountId: result.accountId,
      requestId: input.requestId ?? null,
      status: AuditLogStatus.SUCCESS,
      summary: `가상 차량 생성 완료 (${vehicleCount}대)`,
      metadata: {
        teslaEmail,
        vehicleIds: result.vehicles.map((vehicle) => vehicle.id),
      },
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      requestId: input.requestId ?? null,
      actorUserId: input.userId,
      teslaAccountId: result.accountId,
      method: "POST",
      url: "/api/vehicles/virtual",
      path: "/api/vehicles/virtual",
      statusCode: 200,
      success: true,
      responseBody: {
        accountId: result.accountId,
        vehicleCount,
      },
    },
  );

  return result;
}
