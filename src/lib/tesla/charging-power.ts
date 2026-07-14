/** Snapshot / Telemetry — AC=완속, DC=급속 */
export type ChargingPowerKind = "AC" | "DC";

export function labelChargingPowerKind(kind: string | null | undefined): string | null {
  if (kind === "AC") return "완속";
  if (kind === "DC") return "급속";
  return null;
}

/**
 * Telemetry AC/DC 출력 → Snapshot kW + kind
 * DC>0 우선, 아니면 AC 값 존재 시 AC. 둘 다 없으면 undefined(merge 유지).
 */
export function resolveChargingPowerFromTelemetry(
  acPower: number | undefined,
  dcPower: number | undefined,
): { chargerPowerKw: number; chargingPowerKind: ChargingPowerKind } | undefined {
  if (dcPower != null && Number.isFinite(dcPower) && dcPower > 0) {
    return { chargerPowerKw: dcPower, chargingPowerKind: "DC" };
  }
  if (acPower != null && Number.isFinite(acPower)) {
    return { chargerPowerKw: acPower, chargingPowerKind: "AC" };
  }
  return undefined;
}
