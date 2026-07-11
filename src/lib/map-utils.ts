import type { VehicleListItemDto, MapVehicle } from "@/lib/types/vehicle";

export function toMapVehicles(vehicles: VehicleListItemDto[]): MapVehicle[] {
  return vehicles
    .filter(
      (vehicle): vehicle is VehicleListItemDto & { snapshot: NonNullable<VehicleListItemDto["snapshot"]> } =>
        vehicle.snapshot != null &&
        vehicle.snapshot.status != null &&
        vehicle.snapshot.latitude != null &&
        vehicle.snapshot.longitude != null,
    )
    .map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      status: vehicle.snapshot.status,
      latitude: vehicle.snapshot.latitude,
      longitude: vehicle.snapshot.longitude,
      batteryPercent: vehicle.snapshot.batteryPercent,
      ignitionOn: vehicle.snapshot.ignitionOn,
      chargingStatus: vehicle.snapshot.chargingStatus,
      lifecycle: vehicle.syncState?.lifecycle ?? null,
      carType: vehicle.carType,
    }));
}
