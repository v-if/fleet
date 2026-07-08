import { prisma } from "@/lib/prisma";
import { unlinkAllVehiclesForAccount } from "@/lib/vehicle-unlink";
import { activeTeslaAccountWhere } from "@/lib/vehicle-query";

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

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
    };
  } catch {
    return null;
  }
}

function getTeslaEmailFromToken(token: TeslaTokenResponse) {
  const email = token.id_token ? decodeJwtPayload(token.id_token)?.email : undefined;
  return email?.trim().toLowerCase() || null;
}

async function persistTokenForUser(
  userId: string,
  token: TeslaTokenResponse,
  accountId?: string,
) {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const scope = token.scope ?? TESLA_OAUTH_SCOPES.join(" ");
  const teslaEmail = getTeslaEmailFromToken(token);
  const existingAccount =
    accountId != null
      ? await prisma.teslaAccount.findUnique({ where: { id: accountId } })
      : teslaEmail
        ? await prisma.teslaAccount.findFirst({
            where: { userId, teslaEmail },
            orderBy: { linkedAt: "desc" },
          })
        : await prisma.teslaAccount.findFirst({
            where: {
              userId,
              teslaEmail: null,
              unlinkedAt: null,
            },
            orderBy: { linkedAt: "desc" },
          });

  if (existingAccount) {
    return prisma.teslaAccount.update({
      where: { id: existingAccount.id },
      data: {
        teslaEmail,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        scope,
        region: null,
        role: null,
        unlinkedAt: null,
      },
    });
  }

  return prisma.teslaAccount.create({
    data: {
      userId,
      teslaEmail,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope,
      region: null,
      role: null,
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

export async function exchangeAuthorizationCode(code: string, userId: string) {
  const { audience } = getTeslaRegionConfig();
  const token = await requestToken({
    grant_type: "authorization_code",
    client_id: getTeslaClientId(),
    client_secret: getTeslaClientSecret(),
    code,
    redirect_uri: getTeslaRedirectUri(),
    audience,
  });

  return persistTokenForUser(userId, token);
}

export async function refreshAccessTokenForAccount(
  userId: string,
  refreshToken: string,
  accountId?: string,
) {
  const token = await requestToken({
    grant_type: "refresh_token",
    client_id: getTeslaClientId(),
    client_secret: getTeslaClientSecret(),
    refresh_token: refreshToken,
  });

  return persistTokenForUser(userId, token, accountId);
}

export async function getActiveTeslaAccountForUser(userId: string) {
  return prisma.teslaAccount.findFirst({
    where: {
      userId,
      ...activeTeslaAccountWhere,
    },
    orderBy: { linkedAt: "desc" },
  });
}

export async function getAnyActiveTeslaAccount() {
  return prisma.teslaAccount.findFirst({
    where: activeTeslaAccountWhere,
    orderBy: { linkedAt: "desc" },
  });
}

/** @deprecated Use getActiveTeslaAccount — kept for status API compatibility */
export async function getStoredTeslaToken(userId: string) {
  return getActiveTeslaAccountForUser(userId);
}

export async function getValidTeslaAccessToken(userId: string) {
  const stored = await getActiveTeslaAccountForUser(userId);
  if (!stored || !stored.refreshToken) {
    throw new Error("Tesla account is not connected. Visit /api/auth/tesla to authorize.");
  }

  const expiresSoon = stored.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return stored.accessToken;
  }

  const refreshed = await refreshAccessTokenForAccount(
    userId,
    stored.refreshToken,
    stored.id,
  );
  return refreshed.accessToken;
}

export async function isTeslaConnected(userId: string) {
  const stored = await getActiveTeslaAccountForUser(userId);
  return Boolean(stored?.refreshToken);
}

export async function disconnectTeslaAccount(userId: string) {
  const account = await getActiveTeslaAccountForUser(userId);
  if (!account) return;

  await unlinkAllVehiclesForAccount(account.id);
}
