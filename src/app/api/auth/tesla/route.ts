import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { buildTeslaAuthorizeUrl } from "@/lib/tesla/auth";
import { isTeslaConfigured } from "@/lib/tesla/config";

const STATE_COOKIE = "tesla_oauth_state";
const USER_COOKIE = "tesla_oauth_user";
const RETURN_TO_COOKIE = "tesla_oauth_return_to";

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    await createAuditLogWithApiCall(
      {
        action: "TESLA_CONNECT_START",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "Tesla 연결 시작 거부: 인증되지 않은 요청",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 401,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Unauthorized",
      },
    );
    return session;
  }

  if (!isTeslaConfigured()) {
    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "TESLA_CONNECT_START",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: "Tesla 연결 시작 실패: Tesla 설정 누락",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session.userId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 503,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Tesla Fleet API credentials are not configured",
      },
    );
    return NextResponse.json(
      { error: "Tesla Fleet API credentials are not configured" },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set(USER_COOKIE, session.userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  if (returnTo) {
    cookieStore.set(RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
  }

  const authorizeUrl = buildTeslaAuthorizeUrl(state);
  await createAuditLogWithApiCall(
    {
      actorUserId: session.userId,
      actorEmail: session.email,
      action: "TESLA_CONNECT_START",
      targetType: "TeslaAccount",
      requestId,
      status: AuditLogStatus.SUCCESS,
      summary: `Tesla 연결 시작: ${session.email}`,
      metadata: sanitizeBody({ returnTo }),
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      requestId,
      actorUserId: session.userId,
      method: "GET",
      url: request.url,
      path: new URL(request.url).pathname,
      statusCode: 302,
      success: true,
      requestHeaders: sanitizeHeaders(request.headers),
      requestBody: sanitizeBody({ returnTo }),
      responseBody: sanitizeBody({ redirectTo: authorizeUrl }),
    },
  );
  return NextResponse.redirect(authorizeUrl);
}
