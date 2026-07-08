import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { exchangeAuthorizationCode } from "@/lib/tesla/auth";
import { syncVehiclesFromProvider } from "@/lib/vehicle-sync";

const STATE_COOKIE = "tesla_oauth_state";
const USER_COOKIE = "tesla_oauth_user";
const RETURN_TO_COOKIE = "tesla_oauth_return_to";

function normalizeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings";
  }
  return value;
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const redirectBase = new URL("/settings", request.url);
    await createAuditLogWithApiCall(
      {
        action: "TESLA_CONNECT_FAILURE",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `Tesla callback 실패: ${error}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ error }),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
        errorMessage: error,
      },
    );
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", error);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !state) {
    const redirectBase = new URL("/settings", request.url);
    await createAuditLogWithApiCall(
      {
        action: "TESLA_CONNECT_FAILURE",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: "Tesla callback 실패: code/state 누락",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ codePresent: Boolean(code), statePresent: Boolean(state) }),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
        errorMessage: "missing_code",
      },
    );
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "missing_code");
    return NextResponse.redirect(redirectBase);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const userId = cookieStore.get(USER_COOKIE)?.value;
  const returnTo = normalizeReturnTo(cookieStore.get(RETURN_TO_COOKIE)?.value);
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(USER_COOKIE);
  cookieStore.delete(RETURN_TO_COOKIE);

  if (!savedState || savedState !== state) {
    const redirectBase = new URL(returnTo, request.url);
    await createAuditLogWithApiCall(
      {
        actorUserId: userId ?? null,
        action: "TESLA_CONNECT_FAILURE",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "Tesla callback 실패: state 불일치",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: userId ?? null,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ statePresent: Boolean(state), savedStatePresent: Boolean(savedState) }),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
        errorMessage: "invalid_state",
      },
    );
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  if (!userId) {
    const redirectBase = new URL(returnTo, request.url);
    await createAuditLogWithApiCall(
      {
        action: "TESLA_CONNECT_FAILURE",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: "Tesla callback 실패: 사용자 컨텍스트 누락",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
        errorMessage: "missing_user_context",
      },
    );
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "missing_user_context");
    return NextResponse.redirect(redirectBase);
  }

  const redirectBase = new URL(returnTo, request.url);
  try {
    await exchangeAuthorizationCode(code, userId);
    await syncVehiclesFromProvider(userId);
    await createAuditLogWithApiCall(
      {
        actorUserId: userId,
        action: "TESLA_CONNECT_SUCCESS",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.SUCCESS,
        summary: "Tesla 연동 성공",
        metadata: sanitizeBody({ returnTo }),
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: userId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: true,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ code: "[REDACTED]", statePresent: true }),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
      },
    );
    redirectBase.searchParams.set("tesla", "connected");
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : "token_exchange_failed";
    await createAuditLogWithApiCall(
      {
        actorUserId: userId,
        action: "TESLA_CONNECT_FAILURE",
        targetType: "TeslaAccount",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `Tesla 연동 실패: ${message}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: userId,
        method: "GET",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 302,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody({ code: "[REDACTED]", statePresent: true }),
        responseBody: sanitizeBody({ redirectTo: redirectBase.toString() }),
        errorMessage: message,
      },
    );
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", message);
  }

  return NextResponse.redirect(redirectBase);
}
