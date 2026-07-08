import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth-session";
import { unlinkVehicle } from "@/lib/vehicle-unlink";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const result = await unlinkVehicle(id);

  if (!result) {
    return NextResponse.json({ error: "Vehicle not found or already unlinked" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
