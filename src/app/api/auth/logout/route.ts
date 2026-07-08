import { clearSessionResponse } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  return clearSessionResponse();
}
