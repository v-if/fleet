import type { Metadata } from "next";
import { Suspense } from "react";

import { FleetSettingsView } from "@/components/fms/FleetSettingsView";

export const metadata: Metadata = {
  title: "연동 설정 | Fleet FMS",
  description: "Tesla Fleet API 연동 설정",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-theme-sm text-gray-500">로딩 중...</p>}>
      <FleetSettingsView />
    </Suspense>
  );
}
