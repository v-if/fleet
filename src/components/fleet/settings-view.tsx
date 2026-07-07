"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, Unlink } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicleRefresh } from "@/hooks/use-vehicles";
import { cn } from "@/lib/utils";

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

export function SettingsView() {
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
      <PageHeader
        breadcrumbs={[{ label: "설정" }]}
        title="연동 설정"
        description="Tesla Fleet API OAuth 연결 및 데이터 동기화를 관리합니다."
        onRefresh={() => void handleSync()}
        isRefreshing={isRefreshing}
      />

      <div className="flex flex-1 flex-col gap-5 p-6">
        {teslaResult === "connected" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" />
            Tesla 계정 연결이 완료되었습니다.
          </div>
        )}

        {teslaResult === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="size-4" />
            Tesla 연결에 실패했습니다: {teslaMessage ?? "unknown"}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tesla Fleet API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">상태를 불러오는 중...</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={status?.configured ? "default" : "outline"}>
                    {status?.configured ? "앱 설정 완료" : "앱 미설정"}
                  </Badge>
                  <Badge variant={status?.connected ? "default" : "outline"}>
                    {status?.connected ? "계정 연결됨" : "계정 미연결"}
                  </Badge>
                  <Badge variant="outline">Provider: {status?.provider ?? "mock"}</Badge>
                  {status?.sync?.usedFallback && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      Mock 폴백 사용 중
                    </Badge>
                  )}
                </div>

                {status?.scope && (
                  <p className="text-sm text-muted-foreground">스코프: {status.scope}</p>
                )}

                {status?.sync?.lastSyncedAt && (
                  <p className="text-sm text-muted-foreground">
                    마지막 동기화: {new Date(status.sync.lastSyncedAt).toLocaleString("ko-KR")}
                  </p>
                )}

                {status?.sync?.lastError && (
                  <p className="text-sm text-amber-700">최근 오류: {status.sync.lastError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {!status?.connected ? (
                    <Link
                      href="/api/auth/tesla"
                      className={cn(buttonVariants(), "inline-flex items-center gap-2")}
                    >
                      <Link2 className="size-4" />
                      Tesla 계정 연결
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => void handleDisconnect()}
                      disabled={isDisconnecting}
                    >
                      <Unlink className="size-4" />
                      연결 해제
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => void handleSync()}
                    disabled={isRefreshing}
                  >
                    지금 동기화
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  `VEHICLE_DATA_PROVIDER=tesla`일 때 OAuth 연결 후 실데이터를 수집합니다.
                  연결 실패 시 Mock 데이터로 자동 폴백됩니다.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
