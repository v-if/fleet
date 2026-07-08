import { ApiCallDirection, AuditLogStatus } from "@prisma/client";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { createSessionResponse, verifyCredentials } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    await createAuditLogWithApiCall(
      {
        actorEmail: email || null,
        action: "LOGIN_FAILURE",
        targetType: "Session",
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: "로그인 실패: 이메일 또는 비밀번호 누락",
        metadata: sanitizeBody(body),
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "POST",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 400,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody(body),
        responseBody: sanitizeBody({ error: "이메일과 비밀번호를 입력해 주세요." }),
        errorMessage: "Missing email or password",
      },
    );
    return Response.json(
      { error: "이메일과 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    await createAuditLogWithApiCall(
      {
        actorEmail: email,
        action: "LOGIN_FAILURE",
        targetType: "Session",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: `로그인 실패: ${email}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: "POST",
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 401,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        requestBody: sanitizeBody(body),
        responseBody: sanitizeBody({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }),
        errorMessage: "Invalid credentials",
      },
    );
    return Response.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  await createAuditLogWithApiCall(
    {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "LOGIN_SUCCESS",
      targetType: "Session",
      targetId: user.id,
      requestId,
      status: AuditLogStatus.SUCCESS,
      summary: `로그인 성공: ${user.email}`,
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      requestId,
      actorUserId: user.id,
      method: "POST",
      url: request.url,
      path: new URL(request.url).pathname,
      statusCode: 200,
      success: true,
      requestHeaders: sanitizeHeaders(request.headers),
      requestBody: sanitizeBody(body),
      responseBody: sanitizeBody({
        ok: true,
        user: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
      }),
    },
  );

  return createSessionResponse({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}
