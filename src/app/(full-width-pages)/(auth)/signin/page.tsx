import SignInForm from "@/components/auth/SignInForm";
import { getCurrentSession } from "@/lib/auth-session";
import { fmsPageTitle } from "@/lib/branding";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: fmsPageTitle("로그인"),
  description: "보리차 차량 관제 시스템 로그인",
};

export default async function SignIn() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  return <SignInForm />;
}
