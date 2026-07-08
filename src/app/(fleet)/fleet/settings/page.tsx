import { Suspense } from "react";

import { SettingsView } from "@/components/fleet/settings-view";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">로딩 중...</div>}>
      <SettingsView />
    </Suspense>
  );
}
