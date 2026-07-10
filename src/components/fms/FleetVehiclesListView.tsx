"use client";

import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { FleetVehicleTable } from "@/components/fms/FleetVehicleTable";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { useModal } from "@/hooks/useModal";
import { formatProviderTime, providerLabel } from "@/lib/fms-badge-utils";
import { FMS_NAME } from "@/lib/branding";
import { useState } from "react";

export function FleetVehiclesListView() {
  const { data, isLoading, isError, error, isFetching } = useVehicles();
  const refreshVehicles = useVehicleRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSeedingVirtual, setIsSeedingVirtual] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const { isOpen, openModal, closeModal } = useModal();

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleConnectTesla() {
    setIsConnecting(true);
    window.location.href = "/api/auth/tesla?returnTo=/vehicles";
  }

  async function handleSeedVirtualVehicles() {
    setIsSeedingVirtual(true);
    setSeedMessage(null);
    setSeedError(null);

    try {
      const response = await fetch("/api/vehicles/virtual", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { vehicleCount?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "가상 차량 추가에 실패했습니다.");
      }

      await refreshVehicles();
      setSeedMessage(`가상 차량 ${payload?.vehicleCount ?? 0}대가 추가되었습니다.`);
    } catch (seedVehicleError) {
      setSeedError(
        seedVehicleError instanceof Error
          ? seedVehicleError.message
          : "가상 차량 추가에 실패했습니다.",
      );
    } finally {
      setIsSeedingVirtual(false);
    }
  }

  if (isLoading) {
    return <p className="text-theme-sm text-gray-500">차량 목록을 불러오는 중...</p>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-error-600">
        {error?.message ?? "차량 목록을 불러오지 못했습니다."}
      </div>
    );
  }

  return (
    <>
      <FleetToolbar
        title="차량 목록"
        provider={providerLabel(data.provider)}
        lastUpdatedAt={formatProviderTime(data.lastUpdatedAt)}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleSeedVirtualVehicles()} disabled={isSeedingVirtual}>
              {isSeedingVirtual ? "생성 중..." : "차량 추가(가상)"}
            </Button>
            <Button size="sm" onClick={openModal}>
              차량 추가
            </Button>
          </div>
        }
      />
      {seedMessage ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4 text-theme-sm text-success-700">
          {seedMessage}
        </div>
      ) : null}
      {seedError ? (
        <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-theme-sm text-error-700">
          {seedError}
        </div>
      ) : null}
      <FleetVehicleTable vehicles={data.vehicles} />
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-[520px] p-6 sm:p-8"
        overlayClassName="bg-gray-400/12 backdrop-blur-[16px]"
      >
        <div className="pr-8">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5V19M5 12H19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            새로운 테슬라 계정의 차량을 추가하시겠습니까?
          </h3>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
            테슬라 공홈에 로그인 후 {FMS_NAME} 연동을 해주시기 바랍니다.
          </p>
          <div className="mt-8 flex justify-end gap-3">
            <Button size="sm" variant="outline" onClick={closeModal}>
              닫기
            </Button>
            <Button size="sm" onClick={handleConnectTesla} disabled={isConnecting}>
              {isConnecting ? "이동 중..." : "확인"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
