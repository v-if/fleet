import type { Metadata } from "next";
import { Suspense } from "react";

import { FleetSettingsView } from "@/components/fms/FleetSettingsView";
import { fmsPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: fmsPageTitle("연동 설정"),
  description: "보리차 Tesla Fleet API 연동 설정",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-theme-sm text-gray-500">로딩 중...</p>}>
      <FleetSettingsView />
    </Suspense>
  );
}
