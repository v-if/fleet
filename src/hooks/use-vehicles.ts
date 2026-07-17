"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { VehicleDetailResponse, VehiclesResponse } from "@/lib/types/vehicle";

export type VehicleListScope = "fleet" | "all";

async function fetchVehicles(
  refresh = false,
  scope: VehicleListScope = "fleet",
): Promise<VehiclesResponse> {
  const params = new URLSearchParams();
  if (refresh) params.set("refresh", "1");
  if (scope === "all") params.set("scope", "all");
  const qs = params.toString();
  const url = qs ? `/api/vehicles?${qs}` : "/api/vehicles";
  const response = await fetch(url);
  if (!response.ok) throw new Error("차량 목록을 불러오지 못했습니다.");
  return response.json();
}

async function fetchVehicleDetail(id: string): Promise<VehicleDetailResponse> {
  const response = await fetch(`/api/vehicles/${id}`);
  if (!response.ok) throw new Error("차량 상세를 불러오지 못했습니다.");
  return response.json();
}

export function useVehicles(options?: { scope?: VehicleListScope }) {
  const scope = options?.scope ?? "fleet";
  return useQuery({
    queryKey: ["vehicles", scope],
    queryFn: () => fetchVehicles(false, scope),
  });
}

export function useVehicleRefresh() {
  const queryClient = useQueryClient();

  return async () => {
    await fetchVehicles(true, "fleet");
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };
}

export function useVehicleDetail(id: string) {
  return useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => fetchVehicleDetail(id),
    enabled: Boolean(id),
  });
}
