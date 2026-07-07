import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildTeslaAuthorizeUrl } from "@/lib/tesla/auth";
import { isTeslaConfigured } from "@/lib/tesla/config";

const STATE_COOKIE = "tesla_oauth_state";

export async function GET() {
  if (!isTeslaConfigured()) {
    return NextResponse.json(
      { error: "Tesla Fleet API credentials are not configured" },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const authorizeUrl = buildTeslaAuthorizeUrl(state);
  return NextResponse.redirect(authorizeUrl);
}
