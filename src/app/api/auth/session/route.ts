import { getCurrentSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  return Response.json({
    authenticated: Boolean(session),
    user: session,
  });
}
