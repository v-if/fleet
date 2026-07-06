import type { VehicleStatus } from "@prisma/client";

import type { VehicleDataProvider, VehicleSnapshotData } from "./types";

type MockVehicleSeed = {
  plateNumber: string;
  model: string;
  year: number;
  oemVehicleId: string;
  latitude: number;
  longitude: number;
  batteryPercent: number;
  rangeKm: number;
  ignitionOn: boolean;
  status: VehicleStatus;
};

const BASE_VEHICLES: MockVehicleSeed[] = [
  {
    plateNumber: "12가3456",
    model: "Tesla Model 3",
    year: 2023,
    oemVehicleId: "tesla-mock-001",
    latitude: 37.5665,
    longitude: 126.978,
    batteryPercent: 82,
    rangeKm: 410,
    ignitionOn: true,
    status: "ONLINE",
  },
  {
    plateNumber: "34나7890",
    model: "Tesla Model Y",
    year: 2024,
    oemVehicleId: "tesla-mock-002",
    latitude: 37.5172,
    longitude: 127.0473,
    batteryPercent: 64,
    rangeKm: 320,
    ignitionOn: true,
    status: "ONLINE",
  },
  {
    plateNumber: "56다1122",
    model: "Tesla Model 3",
    year: 2022,
    oemVehicleId: "tesla-mock-003",
    latitude: 37.5796,
    longitude: 126.977,
    batteryPercent: 41,
    rangeKm: 210,
    ignitionOn: false,
    status: "WARNING",
  },
  {
    plateNumber: "78라3344",
    model: "Tesla Model Y",
    year: 2023,
    oemVehicleId: "tesla-mock-004",
    latitude: 37.5512,
    longitude: 126.9882,
    batteryPercent: 18,
    rangeKm: 85,
    ignitionOn: false,
    status: "ALERT",
  },
  {
    plateNumber: "90마5566",
    model: "Tesla Model 3",
    year: 2021,
    oemVehicleId: "tesla-mock-005",
    latitude: 37.4979,
    longitude: 127.0276,
    batteryPercent: 55,
    rangeKm: 280,
    ignitionOn: false,
    status: "OFFLINE",
  },
  {
    plateNumber: "11바7788",
    model: "Tesla Model Y",
    year: 2024,
    oemVehicleId: "tesla-mock-006",
    latitude: 37.5407,
    longitude: 127.0692,
    batteryPercent: 73,
    rangeKm: 360,
    ignitionOn: true,
    status: "ONLINE",
  },
  {
    plateNumber: "22사9900",
    model: "Tesla Model 3",
    year: 2023,
    oemVehicleId: "tesla-mock-007",
    latitude: 37.4842,
    longitude: 127.0345,
    batteryPercent: 29,
    rangeKm: 150,
    ignitionOn: false,
    status: "WARNING",
  },
  {
    plateNumber: "33아1357",
    model: "Tesla Model Y",
    year: 2022,
    oemVehicleId: "tesla-mock-008",
    latitude: 37.5799,
    longitude: 126.8912,
    batteryPercent: 91,
    rangeKm: 455,
    ignitionOn: true,
    status: "ONLINE",
  },
  {
    plateNumber: "44자2468",
    model: "Tesla Model 3",
    year: 2024,
    oemVehicleId: "tesla-mock-009",
    latitude: 37.4563,
    longitude: 126.7052,
    batteryPercent: 12,
    rangeKm: 55,
    ignitionOn: false,
    status: "ALERT",
  },
  {
    plateNumber: "55차3579",
    model: "Tesla Model Y",
    year: 2023,
    oemVehicleId: "tesla-mock-010",
    latitude: 37.3947,
    longitude: 127.1112,
    batteryPercent: 48,
    rangeKm: 245,
    ignitionOn: false,
    status: "OFFLINE",
  },
  {
    plateNumber: "66카4680",
    model: "Tesla Model 3",
    year: 2022,
    oemVehicleId: "tesla-mock-011",
    latitude: 37.3595,
    longitude: 127.1052,
    batteryPercent: 67,
    rangeKm: 330,
    ignitionOn: true,
    status: "ONLINE",
  },
  {
    plateNumber: "77타5791",
    model: "Tesla Model Y",
    year: 2021,
    oemVehicleId: "tesla-mock-012",
    latitude: 37.3219,
    longitude: 127.1267,
    batteryPercent: 22,
    rangeKm: 120,
    ignitionOn: false,
    status: "WARNING",
  },
];

function withJitter(value: number, range: number) {
  return value + (Math.random() - 0.5) * range;
}

function toSnapshot(vehicle: MockVehicleSeed): VehicleSnapshotData {
  const now = new Date();

  return {
    plateNumber: vehicle.plateNumber,
    model: vehicle.model,
    year: vehicle.year,
    oemVehicleId: vehicle.oemVehicleId,
    latitude: withJitter(vehicle.latitude, 0.01),
    longitude: withJitter(vehicle.longitude, 0.01),
    batteryPercent: Math.max(5, withJitter(vehicle.batteryPercent, 2)),
    rangeKm: Math.max(20, withJitter(vehicle.rangeKm, 15)),
    ignitionOn: vehicle.ignitionOn,
    status: vehicle.status,
    lastUpdatedAt: now,
  };
}

export class MockVehicleProvider implements VehicleDataProvider {
  readonly name = "mock";

  async fetchVehicles(): Promise<VehicleSnapshotData[]> {
    return BASE_VEHICLES.map(toSnapshot);
  }

  async fetchVehicleDetail(
    plateNumber: string,
  ): Promise<VehicleSnapshotData | null> {
    const vehicle = BASE_VEHICLES.find((item) => item.plateNumber === plateNumber);
    return vehicle ? toSnapshot(vehicle) : null;
  }
}

export function getMockVehicleEvents() {
  return [
    {
      plateNumber: "78라3344",
      type: "ALERT" as const,
      message: "배터리 잔량 20% 미만",
      occurredAt: new Date(),
    },
    {
      plateNumber: "90마5566",
      type: "OFFLINE" as const,
      message: "7일 이상 미운행",
      occurredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      plateNumber: "56다1122",
      type: "WARNING" as const,
      message: "배터리 충전 권장",
      occurredAt: new Date(),
    },
  ];
}
