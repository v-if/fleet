import React from "react";

import { requirePageSession } from "@/lib/auth-session";
import AdminShell from "@/layout/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession();

  return (
    <AdminShell>{children}</AdminShell>
  );
}
