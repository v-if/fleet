import { ApiCallDirection, AuditLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  createAuditLogWithApiCall,
  getOrCreateRequestId,
  sanitizeBody,
  sanitizeHeaders,
} from "@/lib/audit-log";
import { requireApiSession } from "@/lib/auth-session";
import { unlinkVehicle } from "@/lib/vehicle-unlink";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const request = _request;
  const requestId = getOrCreateRequestId(request);
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    await createAuditLogWithApiCall(
      {
        action: "VEHICLE_UNLINK",
        targetType: "Vehicle",
        requestId,
        status: AuditLogStatus.DENIED,
        summary: "차량 연동 해제 거부: 인증되지 않은 요청",
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        method: request.method,
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

  const { id } = await context.params;
  const result = await unlinkVehicle(id);

  if (!result) {
    await createAuditLogWithApiCall(
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        action: "VEHICLE_UNLINK",
        targetType: "Vehicle",
        targetId: id,
        vehicleId: id,
        requestId,
        status: AuditLogStatus.FAILURE,
        summary: `차량 연동 해제 실패: ${id}`,
      },
      {
        direction: ApiCallDirection.INBOUND,
        system: "FMS",
        requestId,
        actorUserId: session.userId,
        vehicleId: id,
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        statusCode: 404,
        success: false,
        requestHeaders: sanitizeHeaders(request.headers),
        errorMessage: "Vehicle not found or already unlinked",
      },
    );
    return NextResponse.json({ error: "Vehicle not found or already unlinked" }, { status: 404 });
  }

  await createAuditLogWithApiCall(
    {
      actorUserId: session.userId,
      actorEmail: session.email,
      action: "VEHICLE_UNLINK",
      targetType: "Vehicle",
      targetId: result.vehicleId,
      vehicleId: result.vehicleId,
      requestId,
      status: AuditLogStatus.SUCCESS,
      summary: `차량 연동 해제(플릿에서 제거) 성공: ${result.vehicleId}`,
      metadata: sanitizeBody({
        accountUnlinked: result.accountUnlinked,
        telemetry: result.telemetry,
      }),
    },
    {
      direction: ApiCallDirection.INBOUND,
      system: "FMS",
      requestId,
      actorUserId: session.userId,
      vehicleId: result.vehicleId,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      statusCode: 200,
      success: true,
      requestHeaders: sanitizeHeaders(request.headers),
      responseBody: sanitizeBody({
        ok: true,
        ...result,
      }),
    },
  );

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
