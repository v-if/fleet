import SignUpForm from "@/components/auth/SignUpForm";
import { fmsPageTitle } from "@/lib/branding";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: fmsPageTitle("회원가입"),
  description: "보리차 차량 관제 시스템 회원가입",
};

export default function SignUp() {
  return <SignUpForm />;
}
