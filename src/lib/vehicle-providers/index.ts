import { MockVehicleProvider } from "./mock-provider";
import { TeslaVehicleProvider } from "./tesla-provider";
import type { VehicleDataProvider } from "./types";

export type VehicleProviderName = "mock" | "tesla";

export function getVehicleProviderName(): VehicleProviderName {
  const value = process.env.VEHICLE_DATA_PROVIDER ?? "mock";
  return value === "tesla" ? "tesla" : "mock";
}

export function createVehicleProvider(): VehicleDataProvider {
  const providerName = getVehicleProviderName();

  switch (providerName) {
    case "tesla":
      if (TeslaVehicleProvider.isAvailable()) {
        return new TeslaVehicleProvider();
      }
      return new MockVehicleProvider();
    case "mock":
    default:
      return new MockVehicleProvider();
  }
}

export * from "./types";
export { MockVehicleProvider, getMockVehicleEvents } from "./mock-provider";
export { TeslaVehicleProvider } from "./tesla-provider";
