/** CAF P1 Snapshot 필드 — merge / ASLEEP 복사 / REST previous 유지 */

export type CafSnapshotCoords = {
  vehicleSpeedKmh?: number | null;
  gpsHeading?: number | null;
  detailedChargeState?: string | null;
  timeToFullChargeHours?: number | null;
  chargeAmps?: number | null;
  chargePortDoorOpen?: boolean | null;
  chargePortLatch?: string | null;
  fastChargerPresent?: boolean | null;
  tpmsHardWarnings?: string | null;
  tpmsSoftWarnings?: string | null;
  destinationName?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  minutesToArrival?: number | null;
  milesToArrival?: number | null;
  expectedEnergyPercentAtArrival?: number | null;
  preconditioningEnabled?: boolean | null;
  valetModeEnabled?: boolean | null;
  serviceModeEnabled?: boolean | null;
  softwareUpdateDownloadPercent?: number | null;
  softwareUpdateInstallPercent?: number | null;
  softwareUpdateVersion?: string | null;
};

export function mergeCafSnapshotFields(
  current: CafSnapshotCoords,
  previous?: CafSnapshotCoords | null,
): Required<{ [K in keyof CafSnapshotCoords]: CafSnapshotCoords[K] | null }> {
  return {
    vehicleSpeedKmh: current.vehicleSpeedKmh ?? previous?.vehicleSpeedKmh ?? null,
    gpsHeading: current.gpsHeading ?? previous?.gpsHeading ?? null,
    detailedChargeState:
      current.detailedChargeState ?? previous?.detailedChargeState ?? null,
    timeToFullChargeHours:
      current.timeToFullChargeHours ?? previous?.timeToFullChargeHours ?? null,
    chargeAmps: current.chargeAmps ?? previous?.chargeAmps ?? null,
    chargePortDoorOpen:
      current.chargePortDoorOpen ?? previous?.chargePortDoorOpen ?? null,
    chargePortLatch: current.chargePortLatch ?? previous?.chargePortLatch ?? null,
    fastChargerPresent:
      current.fastChargerPresent ?? previous?.fastChargerPresent ?? null,
    tpmsHardWarnings: current.tpmsHardWarnings ?? previous?.tpmsHardWarnings ?? null,
    tpmsSoftWarnings: current.tpmsSoftWarnings ?? previous?.tpmsSoftWarnings ?? null,
    destinationName: current.destinationName ?? previous?.destinationName ?? null,
    destinationLatitude:
      current.destinationLatitude ?? previous?.destinationLatitude ?? null,
    destinationLongitude:
      current.destinationLongitude ?? previous?.destinationLongitude ?? null,
    minutesToArrival: current.minutesToArrival ?? previous?.minutesToArrival ?? null,
    milesToArrival: current.milesToArrival ?? previous?.milesToArrival ?? null,
    expectedEnergyPercentAtArrival:
      current.expectedEnergyPercentAtArrival ??
      previous?.expectedEnergyPercentAtArrival ??
      null,
    preconditioningEnabled:
      current.preconditioningEnabled ?? previous?.preconditioningEnabled ?? null,
    valetModeEnabled: current.valetModeEnabled ?? previous?.valetModeEnabled ?? null,
    serviceModeEnabled:
      current.serviceModeEnabled ?? previous?.serviceModeEnabled ?? null,
    softwareUpdateDownloadPercent:
      current.softwareUpdateDownloadPercent ??
      previous?.softwareUpdateDownloadPercent ??
      null,
    softwareUpdateInstallPercent:
      current.softwareUpdateInstallPercent ??
      previous?.softwareUpdateInstallPercent ??
      null,
    softwareUpdateVersion:
      current.softwareUpdateVersion ?? previous?.softwareUpdateVersion ?? null,
  };
}

export function pickCafSnapshotFields(
  source: CafSnapshotCoords | null | undefined,
): CafSnapshotCoords {
  if (!source) return {};
  return mergeCafSnapshotFields(source, null);
}

/** VD3-DC: 네비 목적지·ETA·도착 예상 SoC 잔상 제거 (주차/절전) */
export function clearTripDestinationFields<T extends CafSnapshotCoords>(
  fields: T,
): T {
  return {
    ...fields,
    destinationName: null,
    destinationLatitude: null,
    destinationLongitude: null,
    minutesToArrival: null,
    milesToArrival: null,
    expectedEnergyPercentAtArrival: null,
  };
}
