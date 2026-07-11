/**
 * Tesla vehicle_config → FMS 표시용 model 문자열
 * @see docs/requirements-tesla-fleet-api-model-mapping.md
 */

const CAR_TYPE_LABELS: Record<string, string> = {
  model3: "Model 3",
  modely: "Model Y",
  models: "Model S",
  modelx: "Model X",
  cybertruck: "Cybertruck",
};

const TRIM_LABELS: Record<string, string> = {
  "50": "RWD",
  "74": "Long Range RWD",
  "74d": "Long Range AWD",
  p74d: "Performance",
  long_range: "Long Range",
  longrange: "Long Range",
  performance: "Performance",
  plaid: "Plaid",
  rwd: "RWD",
  awd: "AWD",
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function labelCarType(carType: string | null | undefined): string | null {
  if (!carType?.trim()) return null;
  const key = normalizeKey(carType);
  return CAR_TYPE_LABELS[key] ?? carType.trim();
}

export function labelTrimBadging(trimBadging: string | null | undefined): string | null {
  if (!trimBadging?.trim()) return null;
  const key = normalizeKey(trimBadging);
  return TRIM_LABELS[key] ?? trimBadging.trim();
}

/** `Model Y · RWD` 형태. carType/trim 없으면 null */
export function buildDisplayModel(
  carType: string | null | undefined,
  trimBadging?: string | null,
): string | null {
  const carLabel = labelCarType(carType);
  if (!carLabel) return null;
  const trimLabel = labelTrimBadging(trimBadging);
  if (!trimLabel) return carLabel;
  return `${carLabel} · ${trimLabel}`;
}
