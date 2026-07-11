import { isTeslaConnected } from "@/lib/tesla/auth";
import { isTeslaConfigured } from "@/lib/tesla/config";
import {
  mapTeslaAlertsToEvents,
  mapTeslaVehicleToSnapshot,
  TeslaFleetClient,
} from "@/lib/tesla/mapper";

import type {
  VehicleDataProvider,
  VehicleEventData,
  VehicleSnapshotData,
} from "./types";

type FetchVehiclesOptions = {
  skipVehicleData?: (vin: string) => Promise<boolean> | boolean;
  /** Telemetry primary: list + fleet_status만 조회, vehicle_data 미호출 */
  registryOnly?: boolean;
};

type FetchVehiclesResult = {
  snapshots: VehicleSnapshotData[];
  skippedVehicleDataCount: number;
  keyPairedVins: string[];
  unpairedVins: string[];
};

export class TeslaVehicleProvider implements VehicleDataProvider {
  readonly name = "tesla";
  private readonly userId?: string;
  private readonly client: TeslaFleetClient;

  constructor(userId?: string) {
    this.userId = userId;
    this.client = new TeslaFleetClient(userId);
  }

  static isAvailable() {
    return isTeslaConfigured();
  }

  async ensureReady() {
    if (!TeslaVehicleProvider.isAvailable()) {
      throw new Error("Tesla Fleet API credentials are not configured");
    }

    if (!this.userId) {
      throw new Error("Tesla user context is missing");
    }

    const connected = await isTeslaConnected(this.userId);
    if (!connected) {
      throw new Error("Tesla account is not connected");
    }
  }

  async fetchVehicles(): Promise<VehicleSnapshotData[]> {
    const result = await this.fetchVehiclesWithMeta();
    return result.snapshots;
  }

  async fetchVehiclesWithMeta(
    options: FetchVehiclesOptions = {},
  ): Promise<FetchVehiclesResult> {
    await this.ensureReady();

    const vehicles = await this.client.listVehicles();
    if (vehicles.length === 0) {
      return {
        snapshots: [],
        skippedVehicleDataCount: 0,
        keyPairedVins: [],
        unpairedVins: [],
      };
    }

    const vins = vehicles.map((vehicle) => vehicle.vin);
    const fleetStatus = await this.client.getFleetStatus(vins);
    const fleetStatusByVin = new Map(
      fleetStatus.items.map((status) => [status.vin, status]),
    );

    const snapshots: VehicleSnapshotData[] = [];
    let skippedVehicleDataCount = 0;

    for (const vehicle of vehicles) {
      const shouldSkipVehicleData =
        options.registryOnly ||
        (options.skipVehicleData ? await options.skipVehicleData(vehicle.vin) : false);

      if (shouldSkipVehicleData) {
        skippedVehicleDataCount += 1;
        snapshots.push(
          mapTeslaVehicleToSnapshot(
            vehicle,
            {
              vin: vehicle.vin,
              display_name: vehicle.display_name,
              state: vehicle.state,
            },
            fleetStatusByVin.get(vehicle.vin),
          ),
        );
        continue;
      }

      try {
        const data = await this.client.getVehicleData(vehicle.vin);
        snapshots.push(
          mapTeslaVehicleToSnapshot(
            vehicle,
            data,
            fleetStatusByVin.get(vehicle.vin),
          ),
        );
      } catch (error) {
        console.warn(`Failed to fetch vehicle_data for ${vehicle.vin}:`, error);
        snapshots.push(
          mapTeslaVehicleToSnapshot(
            vehicle,
            {
              vin: vehicle.vin,
              display_name: vehicle.display_name,
              state: vehicle.state,
            },
            fleetStatusByVin.get(vehicle.vin),
          ),
        );
      }
    }

    return {
      snapshots,
      skippedVehicleDataCount,
      keyPairedVins: fleetStatus.keyPairedVins,
      unpairedVins: fleetStatus.unpairedVins,
    };
  }

  async fetchVehicleDetail(plateNumber: string): Promise<VehicleSnapshotData | null> {
    const result = await this.fetchVehiclesWithMeta();
    return result.snapshots.find((vehicle) => vehicle.plateNumber === plateNumber) ?? null;
  }

  async fetchVehicleEvents(): Promise<VehicleEventData[]> {
    await this.ensureReady();

    const vehicles = await this.client.listVehicles();
    const events: VehicleEventData[] = [];

    for (const vehicle of vehicles) {
      try {
        const alerts = await this.client.getRecentAlerts(vehicle.vin);
        const plateNumber =
          vehicle.display_name?.trim() ||
          `TESLA-${vehicle.vin.slice(-6).toUpperCase()}`;
        events.push(...mapTeslaAlertsToEvents(plateNumber, alerts));
      } catch (error) {
        console.warn(`Failed to fetch recent_alerts for ${vehicle.vin}:`, error);
      }
    }

    return events;
  }
}
