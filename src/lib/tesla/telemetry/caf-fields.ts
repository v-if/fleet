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
  /** VD3-DCn — DB 미저장 · merge 입력 전용 */
  tripNavCleared?: boolean;
  preconditioningEnabled?: boolean | null;
  valetModeEnabled?: boolean | null;
  serviceModeEnabled?: boolean | null;
  softwareUpdateDownloadPercent?: number | null;
  softwareUpdateInstallPercent?: number | null;
  softwareUpdateVersion?: string | null;
};

type CafPersistedCoords = Omit<CafSnapshotCoords, "tripNavCleared">;

/** 내비 Nav/ETA/도착 SoC만 클리어 (속도·헤딩 유지) — VD3-DCn */
export function clearTripNavFieldsOnly<T extends CafSnapshotCoords>(fields: T): T {
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

export function mergeCafSnapshotFields(
  current: CafSnapshotCoords,
  previous?: CafSnapshotCoords | null,
  options?: { suppressTripCoalesce?: boolean },
): Required<{ [K in keyof CafPersistedCoords]: CafPersistedCoords[K] | null }> {
  const suppressTripCoalesce = options?.suppressTripCoalesce ?? false;
  const tripNavCleared = current.tripNavCleared === true;

  const navName = tripNavCleared
    ? null
    : mergeTripAwareField("destinationName", current, previous, suppressTripCoalesce);
  const navLat = tripNavCleared
    ? null
    : mergeTripAwareField(
        "destinationLatitude",
        current,
        previous,
        suppressTripCoalesce,
      );
  const navLng = tripNavCleared
    ? null
    : mergeTripAwareField(
        "destinationLongitude",
        current,
        previous,
        suppressTripCoalesce,
      );
  const navMin = tripNavCleared
    ? null
    : mergeTripAwareField("minutesToArrival", current, previous, suppressTripCoalesce);
  const navMiles = tripNavCleared
    ? null
    : mergeTripAwareField("milesToArrival", current, previous, suppressTripCoalesce);
  const navEnergy = tripNavCleared
    ? null
    : mergeTripAwareField(
        "expectedEnergyPercentAtArrival",
        current,
        previous,
        suppressTripCoalesce,
      );

  return {
    vehicleSpeedKmh: mergeTripAwareField(
      "vehicleSpeedKmh",
      current,
      previous,
      suppressTripCoalesce,
    ),
    gpsHeading: mergeTripAwareField("gpsHeading", current, previous, suppressTripCoalesce),
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
    destinationName: navName,
    destinationLatitude: navLat,
    destinationLongitude: navLng,
    minutesToArrival: navMin,
    milesToArrival: navMiles,
    expectedEnergyPercentAtArrival: navEnergy,
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

/** VD3-DC / VD3-DCf: 네비·ETA·도착 SoC·주행 속도/헤딩 잔상 제거 (주차/절전) */
export function clearTripDestinationFields<T extends CafSnapshotCoords>(
  fields: T,
): T {
  return {
    ...clearTripNavFieldsOnly(fields),
    vehicleSpeedKmh: null,
    gpsHeading: null,
  };
}

const TRIP_COALESCE_KEYS = [
  "destinationName",
  "destinationLatitude",
  "destinationLongitude",
  "minutesToArrival",
  "milesToArrival",
  "expectedEnergyPercentAtArrival",
  "vehicleSpeedKmh",
  "gpsHeading",
] as const satisfies readonly (keyof CafPersistedCoords)[];

/** suppressTripCoalesce 시 current만 · 아니면 current ?? previous. 클리어는 tripNavCleared. */
function mergeTripAwareField<K extends (typeof TRIP_COALESCE_KEYS)[number]>(
  key: K,
  current: CafSnapshotCoords,
  previous: CafSnapshotCoords | null | undefined,
  suppressTripCoalesce: boolean,
): NonNullable<CafPersistedCoords[K]> | null {
  const value = suppressTripCoalesce
    ? current[key]
    : (current[key] ?? previous?.[key]);
  return (value ?? null) as NonNullable<CafPersistedCoords[K]> | null;
}
