"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useVehicleRefresh, useVehicles } from "@/hooks/use-vehicles";
import {
  LIFECYCLE_LABEL,
  lifecycleBadgeColor,
  shouldShowLifecycleBadge,
} from "@/lib/vehicle-lifecycle";

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
  telemetry: {
    enabled: boolean;
    primaryMode: boolean;
    restAutoSync: boolean;
    webhookUrl: string | null;
    lastReceivedAt: string | null;
    lastProcessedAt: string | null;
    lastError: string | null;
    pendingIngressCount: number;
    subscriptionCount: number;
  };
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
  const { data: vehiclesData } = useVehicles();
  const { data: status, isLoading } = useQuery({
    queryKey: ["tesla-status"],
    queryFn: fetchTeslaStatus,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFallbackSyncing, setIsFallbackSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const telemetryPrimary = status?.telemetry.primaryMode ?? false;

  const onboardingVehicles = useMemo(() => {
    return (vehiclesData?.vehicles ?? []).filter((vehicle) =>
      shouldShowLifecycleBadge(vehicle.syncState?.lifecycle),
    );
  }, [vehiclesData?.vehicles]);

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

  async function handleFallbackSync() {
    setIsFallbackSyncing(true);
    try {
      await fetch("/api/sync/vehicles?fallback=1", { method: "POST" });
      await refreshVehicles();
      await queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
    } finally {
      setIsFallbackSyncing(false);
    }
  }

  const teslaResult = searchParams.get("tesla");
  const teslaMessage = searchParams.get("message");

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

        {onboardingVehicles.length > 0 ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-500/30 dark:bg-warning-500/10 lg:p-6">
            <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              온보딩 대기 차량
            </h4>
            <p className="mb-4 text-theme-sm text-gray-600 dark:text-gray-300">
              Virtual Key 확인 또는 Telemetry/Baseline이 끝나지 않은 차량입니다. 상세에서 키
              확인·Baseline을 진행하세요. 서버는 차량을 자동으로 깨우지 않습니다.
            </p>
            <ul className="space-y-2">
              {onboardingVehicles.slice(0, 8).map((vehicle) => {
                const lifecycle = vehicle.syncState?.lifecycle;
                return (
                  <li
                    key={vehicle.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-100 bg-white/70 px-3 py-2 dark:border-warning-500/20 dark:bg-black/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {vehicle.plateNumber}
                      </p>
                      <p className="truncate text-theme-xs text-gray-500">{vehicle.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lifecycle ? (
                        <Badge size="sm" color={lifecycleBadgeColor(lifecycle)}>
                          {LIFECYCLE_LABEL[lifecycle]}
                        </Badge>
                      ) : null}
                      <Link href={`/vehicles/${vehicle.id}`}>
                        <Button size="sm" variant="outline">
                          상세
                        </Button>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
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
                  <Link href="/api/auth/tesla?returnTo=/settings">
                    <Button size="sm">Tesla 계정 연결</Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDisconnect()}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? "해제 중..." : "연결 해제"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSync()}
                  disabled={isRefreshing}
                >
                  {isRefreshing
                    ? "동기화 중..."
                    : telemetryPrimary
                      ? "차량 목록 동기화"
                      : "지금 동기화"}
                </Button>
                {telemetryPrimary ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleFallbackSync()}
                    disabled={isFallbackSyncing}
                  >
                    {isFallbackSyncing ? "REST 동기화 중..." : "REST fallback 동기화"}
                  </Button>
                ) : null}
              </div>

              <p className="text-theme-xs text-gray-400 dark:text-gray-500">
                {telemetryPrimary
                  ? "Telemetry primary 모드: REST 주기 폴링은 중지되며 VehicleSnapshot은 webhook 수신으로만 갱신됩니다. 차량 목록 동기화는 Tesla 계정 차량 등록·해제만 반영합니다."
                  : "`VEHICLE_DATA_PROVIDER=tesla`일 때 OAuth 연결 후 REST 폴링으로 실데이터를 수집합니다."}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Fleet Telemetry
          </h4>

          {isLoading ? (
            <p className="text-theme-sm text-gray-500">상태를 불러오는 중...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge color={status?.telemetry.enabled ? "success" : "light"}>
                  {status?.telemetry.enabled ? "Telemetry 활성" : "Telemetry 비활성"}
                </Badge>
                {status?.telemetry.primaryMode ? (
                  <Badge color="success">Telemetry Primary</Badge>
                ) : null}
                {!status?.telemetry.restAutoSync && status?.telemetry.enabled ? (
                  <Badge color="info">REST 폴링 중지</Badge>
                ) : null}
                {(status?.telemetry.pendingIngressCount ?? 0) > 0 ? (
                  <Badge color="warning">
                    대기 {status?.telemetry.pendingIngressCount}건
                  </Badge>
                ) : null}
                <Badge color="info">
                  구독 {status?.telemetry.subscriptionCount ?? 0}대
                </Badge>
              </div>

              {status?.telemetry.lastReceivedAt ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  최근 수신:{" "}
                  {new Date(status.telemetry.lastReceivedAt).toLocaleString("ko-KR")}
                </p>
              ) : (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  최근 수신: 없음
                </p>
              )}

              {status?.telemetry.lastProcessedAt ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  최근 처리:{" "}
                  {new Date(status.telemetry.lastProcessedAt).toLocaleString("ko-KR")}
                </p>
              ) : null}

              {status?.telemetry.lastError ? (
                <p className="text-theme-sm text-warning-600">{status.telemetry.lastError}</p>
              ) : null}

              <p className="text-theme-xs text-gray-400 dark:text-gray-500">
                Webhook: {status?.telemetry.webhookUrl ?? "`/api/tesla/telemetry`"} · 후처리:{" "}
                `/api/internal/telemetry/process`
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
