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
    await this.ensureReady();

    const vehicles = await this.client.listVehicles();
    if (vehicles.length === 0) {
      return [];
    }

    const vins = vehicles.map((vehicle) => vehicle.vin);
    const fleetStatuses = await this.client.getFleetStatus(vins);
    const fleetStatusByVin = new Map(
      fleetStatuses.map((status) => [status.vin, status]),
    );

    const snapshots: VehicleSnapshotData[] = [];

    for (const vehicle of vehicles) {
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

    return snapshots;
  }

  async fetchVehicleDetail(plateNumber: string): Promise<VehicleSnapshotData | null> {
    const vehicles = await this.fetchVehicles();
    return vehicles.find((vehicle) => vehicle.plateNumber === plateNumber) ?? null;
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
