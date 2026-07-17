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
  isOnboardingLifecycle,
  lifecycleBadgeColor,
  needsVirtualKeyQr,
} from "@/lib/vehicle-lifecycle";
import {
  TESLA_VIRTUAL_KEY_PAIRING_URL,
  openTeslaVirtualKeyPairingPage,
} from "@/lib/tesla/virtual-key-pairing";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

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

function stepState(
  lifecycle: string | null | undefined,
): { current: number; labels: string[] } {
  const labels = ["계정·가져오기", "가상키(QR)", "Telemetry 등록", "수신 확인"];
  if (!lifecycle || lifecycle === "REGISTERED" || lifecycle === "KEY_PENDING") {
    return { current: 2, labels };
  }
  if (lifecycle === "TELEMETRY_PENDING") {
    return { current: 3, labels };
  }
  if (lifecycle === "TELEMETRY_DISCONNECTED") {
    return { current: 3, labels };
  }
  return { current: 4, labels };
}

export function FleetVehiclesSettingsView() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const refreshVehicles = useVehicleRefresh();
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles({
    scope: "all",
  });
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["tesla-status"],
    queryFn: fetchTeslaStatus,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnectingAccount, setIsDisconnectingAccount] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const vehicles = vehiclesData?.vehicles ?? [];
  const onboarding = useMemo(
    () => vehicles.filter((v) => isOnboardingLifecycle(v.syncState?.lifecycle)),
    [vehicles],
  );
  const registered = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          v.syncState?.lifecycle === "READY" ||
          v.syncState?.lifecycle === "TELEMETRY_DISCONNECTED",
      ),
    [vehicles],
  );

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const selectedLifecycle = selected?.syncState?.lifecycle;
  const steps = stepState(selectedLifecycle);
  const needsQr = needsVirtualKeyQr(selectedLifecycle);

  const teslaResult = searchParams.get("tesla");
  const teslaMessage = searchParams.get("message");
  const showDemoSeed = process.env.NODE_ENV === "development";

  async function invalidateAll() {
    await refreshVehicles();
    await queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
  }

  function handleSelectVehicle(vehicle: VehicleListItemDto, openAk: boolean) {
    setSelectedId(vehicle.id);
    setActionMessage(null);
    setPopupBlocked(false);
    if (openAk && needsVirtualKeyQr(vehicle.syncState?.lifecycle)) {
      const win = openTeslaVirtualKeyPairingPage();
      if (!win) {
        setPopupBlocked(true);
        setActionMessage(
          "팝업이 차단되었습니다. 아래 링크로 가상키 안내 페이지를 열어주세요.",
        );
      } else {
        setActionMessage(
          "가상키 안내 페이지를 열었습니다. 휴대폰으로 QR을 촬영·앱에서 동의한 뒤 「키 연결 확인」과 「Telemetry 등록」을 진행하세요.",
        );
      }
    }
  }

  function handleOpenAk() {
    const win = openTeslaVirtualKeyPairingPage();
    setPopupBlocked(!win);
    if (!win) {
      setActionMessage(
        "팝업이 차단되었습니다. 아래 링크로 가상키 안내 페이지를 열어주세요.",
      );
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setActionMessage(null);
    try {
      await fetch("/api/sync/vehicles", { method: "POST" });
      await invalidateAll();
      setActionMessage("차량 목록을 가져왔습니다.");
    } catch {
      setActionMessage("차량 목록 동기화에 실패했습니다.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnectAccount() {
    if (
      !window.confirm(
        "Tesla 계정 연결을 해제하면 연동된 차량이 플릿에서 제거될 수 있습니다. 계속할까요?",
      )
    ) {
      return;
    }
    setIsDisconnectingAccount(true);
    try {
      await fetch("/api/auth/tesla/status", { method: "DELETE" });
      await invalidateAll();
      setSelectedId(null);
    } finally {
      setIsDisconnectingAccount(false);
    }
  }

  async function handleConfirmKey() {
    if (!selectedId) return;
    setBusy("confirm");
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${selectedId}/virtual-key/confirm`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        const err = body.error ?? "키 연결 확인에 실패했습니다.";
        setActionMessage(err);
        if (err.includes("virtual_key") || err.includes("not_paired")) {
          handleOpenAk();
        }
        return;
      }
      setActionMessage("차량 키가 확인되었습니다. 「Telemetry 등록」을 진행하세요.");
      await invalidateAll();
    } catch {
      setActionMessage("키 연결 확인 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleTelemetryRegister() {
    if (!selectedId) return;
    setBusy("telemetry");
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${selectedId}/telemetry/reconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        virtualKey?: { ok?: boolean; error?: string };
      };
      if (!response.ok) {
        const err = body.error ?? "Telemetry 등록에 실패했습니다.";
        setActionMessage(err);
        if (
          err.includes("virtual_key") ||
          body.virtualKey?.ok === false ||
          body.virtualKey?.error?.includes("virtual_key")
        ) {
          handleOpenAk();
          setActionMessage(
            `${err} — 가상키가 필요합니다. QR 안내 페이지를 다시 열어 앱에서 동의한 뒤 재시도하세요.`,
          );
        }
        return;
      }
      if (body.virtualKey && body.virtualKey.ok === false) {
        handleOpenAk();
        setActionMessage(
          "Telemetry 처리는 진행됐으나 키 확인에 실패했습니다. QR·앱 동의 후 「키 연결 확인」을 다시 눌러주세요.",
        );
      } else {
        setActionMessage(
          "Telemetry 등록을 요청했습니다. 차량이 깨어 있으면 수신 후 관제 목록에 나타납니다.",
        );
      }
      await invalidateAll();
    } catch {
      setActionMessage("Telemetry 등록 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnectTelemetry(vehicleId: string) {
    if (!window.confirm("이 차량의 실시간(Telemetry) 연동만 끕니다. 가상키는 유지됩니다.")) {
      return;
    }
    setBusy(`disconnect-${vehicleId}`);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/telemetry/disconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionMessage(body.error ?? "연동 끄기에 실패했습니다.");
        return;
      }
      setActionMessage("실시간 연동을 껐습니다. 「다시 켜기」로 재등록할 수 있습니다(QR 불필요).");
      await invalidateAll();
    } catch {
      setActionMessage("연동 끄기 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReconnectTelemetry(vehicleId: string) {
    setBusy(`reconnect-${vehicleId}`);
    setSelectedId(vehicleId);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/telemetry/reconnect`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        virtualKey?: { ok?: boolean; error?: string };
      };
      if (!response.ok) {
        const err = body.error ?? "다시 켜기에 실패했습니다.";
        setActionMessage(err);
        if (err.includes("virtual_key") || body.virtualKey?.ok === false) {
          handleOpenAk();
          setActionMessage(
            `${err} — 차량에서 가상키가 제거된 것으로 보입니다. QR 안내 후 키 연결을 다시 진행하세요.`,
          );
        }
        return;
      }
      setActionMessage("실시간 연동을 다시 켰습니다.");
      await invalidateAll();
    } catch {
      setActionMessage("다시 켜기 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleUnlink(vehicleId: string) {
    if (
      !window.confirm(
        "플릿에서 이 차량을 제거합니다. Telemetry 구독도 해제됩니다. 계속할까요?",
      )
    ) {
      return;
    }
    setBusy(`unlink-${vehicleId}`);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/unlink`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionMessage(body.error ?? "플릿 제거에 실패했습니다.");
        return;
      }
      if (selectedId === vehicleId) setSelectedId(null);
      setActionMessage("차량을 플릿에서 제거했습니다.");
      await invalidateAll();
    } catch {
      setActionMessage("플릿 제거 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSeedVirtual() {
    setBusy("seed");
    setSeedMessage(null);
    try {
      const response = await fetch("/api/vehicles/virtual", { method: "POST" });
      const payload = (await response.json()) as {
        vehicleCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "가상 차량 추가 실패");
      }
      setSeedMessage(`가상 차량 ${payload.vehicleCount ?? 0}대가 추가되었습니다.`);
      await invalidateAll();
    } catch (error) {
      setSeedMessage(
        error instanceof Error ? error.message : "가상 차량 추가에 실패했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <FleetToolbar
        title="차량 등록 · 연동"
        description="Tesla 계정 연동부터 가상키·Telemetry 등록까지 Vehicles Settings에서 진행합니다."
        onRefresh={() => void handleSync()}
        isRefreshing={isSyncing}
        layout="inline"
      />

      <div className="space-y-5">
        {teslaResult === "connected" ? (
          <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-theme-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500">
            Tesla 계정 연결이 완료되었습니다. 「차량 목록 가져오기」를 진행하세요.
          </div>
        ) : null}
        {teslaResult === "error" ? (
          <div className="rounded-2xl border border-error-200 bg-error-50 px-4 py-3 text-theme-sm text-error-700">
            Tesla 연결에 실패했습니다: {teslaMessage ?? "unknown"}
          </div>
        ) : null}
        {actionMessage ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-theme-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
            {actionMessage}
            {popupBlocked ? (
              <p className="mt-2">
                <a
                  href={TESLA_VIRTUAL_KEY_PAIRING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-500 underline"
                >
                  가상키 안내 페이지 열기
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* A. 계정 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            1. Tesla 계정 · 차량 가져오기
          </h4>
          <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
            계정을 연결하면 Tesla에 등록된 차량이 아래에 나타납니다. 관제 목록에는 Telemetry
            등록을 마친 차량만 표시됩니다.
          </p>
          {statusLoading ? (
            <p className="text-theme-sm text-gray-500">상태를 불러오는 중...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge color={status?.configured ? "success" : "light"}>
                  {status?.configured ? "앱 설정 완료" : "앱 미설정"}
                </Badge>
                <Badge color={status?.connected ? "success" : "warning"}>
                  {status?.connected ? "계정 연결됨" : "계정 미연결"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {!status?.connected ? (
                  <Link href="/api/auth/tesla?returnTo=/vehicles/settings">
                    <Button size="sm">Tesla 계정 연결</Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDisconnectAccount()}
                    disabled={isDisconnectingAccount}
                  >
                    {isDisconnectingAccount ? "해제 중..." : "계정 연결 해제"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSync()}
                  disabled={isSyncing || !status?.connected}
                >
                  {isSyncing ? "가져오는 중..." : "차량 목록 가져오기"}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 선택 차량 위저드 */}
        {selected ? (
          <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-500/30 dark:bg-brand-500/5 lg:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  선택 차량 · 등록 스텝
                </h4>
                <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-300">
                  {selected.plateNumber} · {selected.model}
                </p>
              </div>
              {selectedLifecycle ? (
                <Badge color={lifecycleBadgeColor(selectedLifecycle)}>
                  {LIFECYCLE_LABEL[selectedLifecycle]}
                </Badge>
              ) : null}
            </div>

            <ol className="mb-5 flex flex-wrap gap-2">
              {steps.labels.map((label, index) => {
                const stepNum = index + 1;
                const done = stepNum < steps.current;
                const current = stepNum === steps.current;
                return (
                  <li
                    key={label}
                    className={`rounded-full border px-3 py-1 text-theme-xs ${
                      done
                        ? "border-success-300 bg-success-50 text-success-700"
                        : current
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-gray-200 text-gray-400 dark:border-gray-700"
                    }`}
                  >
                    {stepNum}. {label}
                  </li>
                );
              })}
            </ol>

            {needsQr ? (
              <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-3 py-3 text-theme-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                <p className="font-medium">최초 등록 — 가상키(QR) 필요</p>
                <p className="mt-1 text-theme-xs">
                  Tesla 안내 페이지의 QR을 휴대폰으로 촬영해 앱에서 동의한 뒤, 「키 연결
                  확인」→「Telemetry 등록」순으로 진행하세요.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleOpenAk}>
                    가상키 안내·QR 열기
                  </Button>
                  <a
                    href={TESLA_VIRTUAL_KEY_PAIRING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-theme-xs text-brand-600 underline"
                  >
                    링크 직접 열기
                  </a>
                </div>
              </div>
            ) : selectedLifecycle === "TELEMETRY_DISCONNECTED" ? (
              <p className="mb-4 text-theme-sm text-gray-600 dark:text-gray-300">
                가상키가 유지된 상태입니다. QR 없이 「다시 켜기」로 Telemetry만 재등록할 수
                있습니다.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {needsQr || selectedLifecycle === "TELEMETRY_PENDING" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void handleConfirmKey()}
                >
                  {busy === "confirm" ? "확인 중..." : "키 연결 확인"}
                </Button>
              ) : null}
              {needsQr ||
              selectedLifecycle === "TELEMETRY_PENDING" ||
              selectedLifecycle === "TELEMETRY_DISCONNECTED" ? (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void handleTelemetryRegister()}
                >
                  {busy === "telemetry" ? "등록 중..." : "Telemetry 등록"}
                </Button>
              ) : null}
              {selectedLifecycle === "READY" ? (
                <Link href={`/vehicles/${selected.id}`}>
                  <Button size="sm" variant="outline">
                    관제 목록·상세에서 보기
                  </Button>
                </Link>
              ) : null}
              <Button size="sm" variant="outline" onClick={handleOpenAk}>
                키 다시 연결(QR)
              </Button>
            </div>
          </section>
        ) : null}

        {/* B. 연동 진행 중 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            연동 진행 중
          </h4>
          <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
            아직 관제 목록에 나오지 않는 차량입니다. 행을 선택하면 최초 등록 시 가상키
            안내(QR) 페이지가 열립니다.
          </p>
          {vehiclesLoading ? (
            <p className="text-theme-sm text-gray-500">불러오는 중...</p>
          ) : onboarding.length === 0 ? (
            <p className="text-theme-sm text-gray-500">진행 중인 차량이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {onboarding.map((vehicle) => {
                const lifecycle = vehicle.syncState?.lifecycle;
                const active = vehicle.id === selectedId;
                return (
                  <li
                    key={vehicle.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                      active
                        ? "border-brand-400 bg-brand-50/80 dark:border-brand-500/40 dark:bg-brand-500/10"
                        : "border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleSelectVehicle(vehicle, true)}
                    >
                      <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {vehicle.plateNumber}
                      </p>
                      <p className="truncate text-theme-xs text-gray-500">{vehicle.model}</p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {lifecycle ? (
                        <Badge size="sm" color={lifecycleBadgeColor(lifecycle)}>
                          {LIFECYCLE_LABEL[lifecycle]}
                        </Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectVehicle(vehicle, true)}
                      >
                        등록 진행
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* B. Telemetry 등록됨 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            Telemetry 등록됨
          </h4>
          <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
            관제 목록에 노출되는 차량입니다. 연동 끄기/다시 켜기는 가상키를 유지하므로 QR이
            필요 없습니다.
          </p>
          {registered.length === 0 ? (
            <p className="text-theme-sm text-gray-500">등록된 차량이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {registered.map((vehicle) => {
                const lifecycle = vehicle.syncState?.lifecycle;
                return (
                  <li
                    key={vehicle.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleSelectVehicle(vehicle, false)}
                    >
                      <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {vehicle.plateNumber}
                      </p>
                      <p className="truncate text-theme-xs text-gray-500">{vehicle.model}</p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
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
                      {lifecycle === "READY" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => void handleDisconnectTelemetry(vehicle.id)}
                        >
                          {busy === `disconnect-${vehicle.id}` ? "처리 중..." : "연동 끄기"}
                        </Button>
                      ) : null}
                      {lifecycle === "TELEMETRY_DISCONNECTED" ? (
                        <Button
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void handleReconnectTelemetry(vehicle.id)}
                        >
                          {busy === `reconnect-${vehicle.id}` ? "처리 중..." : "다시 켜기"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void handleUnlink(vehicle.id)}
                      >
                        {busy === `unlink-${vehicle.id}` ? "제거 중..." : "플릿 제거"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {showDemoSeed ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-white/[0.03]">
            <h4 className="mb-2 text-theme-sm font-semibold text-gray-700 dark:text-gray-200">
              개발/데모 · 가상 차량
            </h4>
            <p className="mb-3 text-theme-xs text-gray-500">
              목록 「차량 추가(가상)」에서 이전된 API입니다. 프로덕션 UI에는 노출하지 않습니다.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void handleSeedVirtual()}
            >
              {busy === "seed" ? "생성 중..." : "차량 추가(가상)"}
            </Button>
            {seedMessage ? (
              <p className="mt-2 text-theme-xs text-gray-600">{seedMessage}</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
