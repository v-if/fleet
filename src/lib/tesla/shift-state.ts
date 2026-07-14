/**
 * drive_state.shift_state / Gear / ShiftStateP 등 → Snapshot 토큰 P|R|N|D
 * @see docs/requirements-tesla-fleet-api-model-mapping2.md §4.2
 */
export function normalizeShiftState(value: unknown): string | undefined {
  if (value == null) return undefined;

  if (typeof value === "number" && Number.isFinite(value)) {
    // proto: Unknown=0 Invalid=1 P=2 R=3 N=4 D=5 SNA=6
    return ({ 2: "P", 3: "R", 4: "N", 5: "D", 6: "P" } as Record<number, string>)[value];
  }

  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    return normalizeShiftState(Number(raw));
  }

  const token = raw.replace(/^ShiftState/i, "").toUpperCase();
  if (token === "SNA") return "P";
  if (["P", "R", "N", "D"].includes(token)) return token;
  if (["PARK", "REVERSE", "NEUTRAL", "DRIVE"].includes(token)) {
    return token[0]!;
  }
  if (token.length === 1) return token;

  return undefined;
}
