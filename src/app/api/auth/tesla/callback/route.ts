import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeAuthorizationCode } from "@/lib/tesla/auth";
import { syncVehiclesFromProvider } from "@/lib/vehicle-sync";

const STATE_COOKIE = "tesla_oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBase = new URL("/settings", request.url);

  if (error) {
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", error);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !state) {
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "missing_code");
    return NextResponse.redirect(redirectBase);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!savedState || savedState !== state) {
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  try {
    await exchangeAuthorizationCode(code);
    await syncVehiclesFromProvider();
    redirectBase.searchParams.set("tesla", "connected");
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : "token_exchange_failed";
    redirectBase.searchParams.set("tesla", "error");
    redirectBase.searchParams.set("message", message);
  }

  return NextResponse.redirect(redirectBase);
}
