"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useVehicleRefresh } from "@/hooks/use-vehicles";

type TeslaStatus = {
  configured: boolean;
  connected: boolean;
  provider: string;
  scope: string | null;
  expiresAt: string | null;
  sync: {
    lastSyncedAt: string | null;
    provider: string | null;
    usedFallback: boolean;
    lastError: string | null;
  } | null;
};

async function fetchTeslaStatus(): Promise<TeslaStatus> {
  const response = await fetch("/api/auth/tesla/status");
  if (!response.ok) throw new Error("상태 조회 실패");
  return response.json();
}

export function FleetSettingsView() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const refreshVehicles = useVehicleRefresh();
  const { data: status, isLoading } = useQuery({
    queryKey: ["tesla-status"],
    queryFn: fetchTeslaStatus,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const teslaResult = searchParams.get("tesla");
  const teslaMessage = searchParams.get("message");

  async function handleSync() {
    setIsRefreshing(true);
    try {
      await fetch("/api/sync/vehicles", { method: "POST" });
      await refreshVehicles();
      await queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await fetch("/api/auth/tesla/status", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <>
      <FleetToolbar
        title="연동 설정"
        description="Tesla Fleet API OAuth 연결 및 데이터 동기화를 관리합니다."
        onRefresh={() => void handleSync()}
        isRefreshing={isRefreshing}
      />

      <div className="space-y-5">
        {teslaResult === "connected" ? (
          <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-theme-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500">
            Tesla 계정 연결이 완료되었습니다.
          </div>
        ) : null}

        {teslaResult === "error" ? (
          <div className="rounded-2xl border border-error-200 bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
            Tesla 연결에 실패했습니다: {teslaMessage ?? "unknown"}
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Tesla Fleet API
          </h4>

          {isLoading ? (
            <p className="text-theme-sm text-gray-500">상태를 불러오는 중...</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge color={status?.configured ? "success" : "light"}>
                  {status?.configured ? "앱 설정 완료" : "앱 미설정"}
                </Badge>
                <Badge color={status?.connected ? "success" : "warning"}>
                  {status?.connected ? "계정 연결됨" : "계정 미연결"}
                </Badge>
                <Badge color="info">Provider: {status?.provider ?? "mock"}</Badge>
                {status?.sync?.usedFallback ? (
                  <Badge color="warning">Mock 폴백 사용 중</Badge>
                ) : null}
              </div>

              {status?.scope ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  스코프: {status.scope}
                </p>
              ) : null}

              {status?.sync?.lastSyncedAt ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  마지막 동기화:{" "}
                  {new Date(status.sync.lastSyncedAt).toLocaleString("ko-KR")}
                </p>
              ) : null}

              {status?.sync?.lastError ? (
                <p className="text-theme-sm text-warning-600">{status.sync.lastError}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {!status?.connected ? (
                  <Link href="/api/auth/tesla">
                    <Button size="sm">Tesla 계정 연결</Button>
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void handleDisconnect()} disabled={isDisconnecting}>
                    {isDisconnecting ? "해제 중..." : "연결 해제"}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void handleSync()} disabled={isRefreshing}>
                  {isRefreshing ? "동기화 중..." : "지금 동기화"}
                </Button>
              </div>

              <p className="text-theme-xs text-gray-400 dark:text-gray-500">
                `VEHICLE_DATA_PROVIDER=tesla`일 때 OAuth 연결 후 실데이터를 수집합니다. 연결
                실패 시 Mock 데이터로 자동 폴백됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
