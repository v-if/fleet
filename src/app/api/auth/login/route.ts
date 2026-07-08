import { createSessionResponse, verifyCredentials } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    return Response.json(
      { error: "이메일과 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return Response.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  return createSessionResponse({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}
