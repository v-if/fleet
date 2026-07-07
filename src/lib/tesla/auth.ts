import { prisma } from "@/lib/prisma";

import {
  getTeslaClientId,
  getTeslaClientSecret,
  getTeslaRedirectUri,
  getTeslaRegionConfig,
  TESLA_AUTH_AUTHORIZE_URL,
  TESLA_AUTH_TOKEN_URL,
  TESLA_OAUTH_SCOPES,
} from "./config";
import type { TeslaTokenResponse } from "./types";

const ACCOUNT_KEY = "default";

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

async function persistToken(token: TeslaTokenResponse) {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  return prisma.teslaOAuthToken.upsert({
    where: { accountKey: ACCOUNT_KEY },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope ?? TESLA_OAUTH_SCOPES.join(" "),
    },
    create: {
      accountKey: ACCOUNT_KEY,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope ?? TESLA_OAUTH_SCOPES.join(" "),
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

  return persistToken(token);
}

export async function getStoredTeslaToken() {
  return prisma.teslaOAuthToken.findUnique({
    where: { accountKey: ACCOUNT_KEY },
  });
}

export async function getValidTeslaAccessToken() {
  const stored = await getStoredTeslaToken();
  if (!stored) {
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
  const stored = await getStoredTeslaToken();
  return Boolean(stored);
}

export async function disconnectTeslaAccount() {
  await prisma.teslaOAuthToken.deleteMany({
    where: { accountKey: ACCOUNT_KEY },
  });
}
