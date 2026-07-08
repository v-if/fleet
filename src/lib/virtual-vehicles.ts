import {
  ApiCallDirection,
  AuditLogStatus,
  ChargingStatus,
  EventType,
  ServiceStatus,
  TeslaAccountRole,
  VehicleStatus,
} from "@prisma/client";

import { createAuditLogWithApiCall } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

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

function randomNearbyChargingSites() {
  const count = randomInt(0, 2);
  return Array.from({ length: count }, (_, index) => ({
    name: `Supercharger ${index + 1}`,
    distanceKm: randomFloat(0.5, 8.5, 1),
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
      snapshot: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        batteryPercent,
        rangeKm: randomInt(90, 520),
        ignitionOn: pickOne([true, false, false]),
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
        nearbyChargingSites: JSON.stringify(randomNearbyChargingSites()),
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
