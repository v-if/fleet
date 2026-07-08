import SignInForm from "@/components/auth/SignInForm";
import { getCurrentSession } from "@/lib/auth-session";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Next.js SignIn Page | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js Signin Page TailAdmin Dashboard Template",
};

export default async function SignIn() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  return <SignInForm />;
}
