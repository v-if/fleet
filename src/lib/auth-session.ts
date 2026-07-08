import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "fleet_session";

type SessionPayload = {
  userId: string;
  email: string;
  name: string | null;
};

type SessionUserRow = {
  id: string;
  email: string;
  name: string | null;
};

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    "fleet-dev-session-secret"
  );
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload;
}

function serializeSession(payload: SessionPayload) {
  const body = encodePayload(payload);
  return `${body}.${sign(body)}`;
}

function parseSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  const [body, signature] = cookieValue.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    return decodePayload(body);
  } catch {
    return null;
  }
}

async function fetchUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function verifyCredentials(email: string, password: string) {
  const rows = await prisma.$queryRaw<SessionUserRow[]>`
    select
      u.id::text as id,
      u.email,
      u.name
    from auth.users au
    join "User" u on u.id::text = au.id::text
    where au.email = ${email}
      and au.deleted_at is null
      and au.encrypted_password = crypt(${password}, au.encrypted_password)
    limit 1
  `;

  return rows[0] ?? null;
}

export async function createSessionResponse(user: SessionPayload) {
  const response = NextResponse.json({
    ok: true,
    user,
  });

  response.cookies.set(AUTH_COOKIE_NAME, serializeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearSessionResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const payload = parseSessionCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!payload) return null;

  const user = await fetchUserById(payload.userId);
  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  } satisfies SessionPayload;
}

export async function requirePageSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/signin");
  }
  return session;
}

export async function requireApiSession() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
