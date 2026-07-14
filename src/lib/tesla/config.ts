export type TeslaRegion = "na" | "eu" | "cn";

type TeslaRegionConfig = {
  fleetApiBase: string;
  audience: string;
};

const REGION_CONFIG: Record<TeslaRegion, TeslaRegionConfig> = {
  na: {
    fleetApiBase: "https://fleet-api.prd.na.vn.cloud.tesla.com",
    audience: "https://fleet-api.prd.na.vn.cloud.tesla.com",
  },
  eu: {
    fleetApiBase: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
    audience: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
  },
  cn: {
    fleetApiBase: "https://fleet-api.prd.cn.vn.cloud.tesla.cn",
    audience: "https://fleet-api.prd.cn.vn.cloud.tesla.cn",
  },
};

export const TESLA_AUTH_AUTHORIZE_URL =
  "https://auth.tesla.com/oauth2/v3/authorize";
export const TESLA_AUTH_TOKEN_URL =
  "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";

export const TESLA_OAUTH_SCOPES = [
  "openid",
  "offline_access",
  "vehicle_device_data",
  "vehicle_location",
] as const;

export function getTeslaRegion(): TeslaRegion {
  const value = process.env.TESLA_FLEET_API_REGION?.toLowerCase();
  if (value === "na" || value === "eu" || value === "cn") {
    return value;
  }
  return "na";
}

export function getTeslaRegionConfig(region = getTeslaRegion()): TeslaRegionConfig {
  return REGION_CONFIG[region];
}

export function getTeslaClientId(): string {
  const clientId = process.env.TESLA_FLEET_API_CLIENT_ID;
  if (!clientId) {
    throw new Error("TESLA_FLEET_API_CLIENT_ID is not configured");
  }
  return clientId;
}

export function getTeslaClientSecret(): string {
  const clientSecret = process.env.TESLA_FLEET_API_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("TESLA_FLEET_API_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

export function getTeslaRedirectUri(): string {
  const redirectUri = process.env.TESLA_FLEET_API_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("TESLA_FLEET_API_REDIRECT_URI is not configured");
  }
  return redirectUri;
}

export function isTeslaConfigured(): boolean {
  return Boolean(
    process.env.TESLA_FLEET_API_CLIENT_ID &&
      process.env.TESLA_FLEET_API_CLIENT_SECRET &&
      process.env.TESLA_FLEET_API_REDIRECT_URI,
  );
}

export function getSyncPollIntervalMs(): number {
  const minutes = Number(process.env.TESLA_SYNC_POLL_INTERVAL_MINUTES ?? "3");
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 3 * 60 * 1000;
  }
  return minutes * 60 * 1000;
}

export function getSyncCronSecret(): string | null {
  // Vercel Cron은 CRON_SECRET 사용 시 Authorization: Bearer 자동 주입
  const value =
    process.env.TESLA_SYNC_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null;
  return value ? value : null;
}
