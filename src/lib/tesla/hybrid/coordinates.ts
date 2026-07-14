/** REST/Telemetry Snapshot 좌표 merge — usable 값이 없을 때 이전 좌표 유지 (LN-R) */
export function mergeSnapshotCoordinates(
  current: { latitude?: number | null; longitude?: number | null },
  previous?: { latitude?: number | null; longitude?: number | null } | null,
): { latitude: number | null; longitude: number | null } {
  return {
    latitude: current.latitude ?? previous?.latitude ?? null,
    longitude: current.longitude ?? previous?.longitude ?? null,
  };
}
