import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const redirectBase = new URL("/settings", request.url);
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", error);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !state) {
    const redirectBase = new URL("/settings", request.url);
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
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  if (!userId) {
    const redirectBase = new URL(returnTo, request.url);
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "missing_user_context");
    return NextResponse.redirect(redirectBase);
  }

  const redirectBase = new URL(returnTo, request.url);
  try {
    await exchangeAuthorizationCode(code, userId);
    await syncVehiclesFromProvider(userId);
    redirectBase.searchParams.set("tesla", "connected");
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : "token_exchange_failed";
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", message);
  }

  return NextResponse.redirect(redirectBase);
}
