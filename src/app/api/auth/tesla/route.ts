import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!isTeslaConfigured()) {
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
  return NextResponse.redirect(authorizeUrl);
}
