import { TeslaAccountRole } from "@prisma/client";

import { getOrCreateDefaultUser } from "@/lib/fms-user";
import { prisma } from "@/lib/prisma";
import { unlinkAllVehiclesForAccount } from "@/lib/vehicle-unlink";
import { activeTeslaAccountWhere } from "@/lib/vehicle-query";

import {
  getTeslaClientId,
  getTeslaClientSecret,
  getTeslaRedirectUri,
  getTeslaRegion,
  getTeslaRegionConfig,
  TESLA_AUTH_AUTHORIZE_URL,
  TESLA_AUTH_TOKEN_URL,
  TESLA_OAUTH_SCOPES,
} from "./config";
import type { TeslaTokenResponse } from "./types";

const PLACEHOLDER_TESLA_EMAIL = "linked@tesla.local";

function buildFormBody(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

async function requestToken(body: Record<string, string>): Promise<TeslaTokenResponse> {
  const response = await fetch(TESLA_AUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildFormBody(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tesla token request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as TeslaTokenResponse;
}

async function persistToken(token: TeslaTokenResponse, teslaEmail = PLACEHOLDER_TESLA_EMAIL) {
  const user = await getOrCreateDefaultUser();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const scope = token.scope ?? TESLA_OAUTH_SCOPES.join(" ");
  const region = getTeslaRegion();

  return prisma.teslaAccount.upsert({
    where: {
      userId_teslaEmail: {
        userId: user.id,
        teslaEmail,
      },
    },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope,
      region,
      role: TeslaAccountRole.OWNER,
      unlinkedAt: null,
    },
    create: {
      userId: user.id,
      teslaEmail,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope,
      region,
      role: TeslaAccountRole.OWNER,
    },
  });
}

export function buildTeslaAuthorizeUrl(state: string) {
  const { audience } = getTeslaRegionConfig();
  const params = new URLSearchParams({
    client_id: getTeslaClientId(),
    redirect_uri: getTeslaRedirectUri(),
    response_type: "code",
    scope: TESLA_OAUTH_SCOPES.join(" "),
    state,
    audience,
    prompt: "login consent",
  });

  return `${TESLA_AUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(code: string) {
  const { audience } = getTeslaRegionConfig();
  const token = await requestToken({
    grant_type: "authorization_code",
    client_id: getTeslaClientId(),
    client_secret: getTeslaClientSecret(),
    code,
    redirect_uri: getTeslaRedirectUri(),
    audience,
  });

  return persistToken(token);
}

export async function refreshAccessToken(refreshToken: string) {
  const token = await requestToken({
    grant_type: "refresh_token",
    client_id: getTeslaClientId(),
    client_secret: getTeslaClientSecret(),
    refresh_token: refreshToken,
  });

  const account = await getActiveTeslaAccount();
  return persistToken(token, account?.teslaEmail ?? PLACEHOLDER_TESLA_EMAIL);
}

export async function getActiveTeslaAccount() {
  const user = await getOrCreateDefaultUser();

  return prisma.teslaAccount.findFirst({
    where: {
      userId: user.id,
      ...activeTeslaAccountWhere,
    },
    orderBy: { linkedAt: "desc" },
  });
}

/** @deprecated Use getActiveTeslaAccount — kept for status API compatibility */
export async function getStoredTeslaToken() {
  return getActiveTeslaAccount();
}

export async function getValidTeslaAccessToken() {
  const stored = await getActiveTeslaAccount();
  if (!stored || !stored.refreshToken) {
    throw new Error("Tesla account is not connected. Visit /api/auth/tesla to authorize.");
  }

  const expiresSoon = stored.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return stored.accessToken;
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  return refreshed.accessToken;
}

export async function isTeslaConnected() {
  const stored = await getActiveTeslaAccount();
  return Boolean(stored?.refreshToken);
}

export async function disconnectTeslaAccount() {
  const account = await getActiveTeslaAccount();
  if (!account) return;

  await unlinkAllVehiclesForAccount(account.id);
}
