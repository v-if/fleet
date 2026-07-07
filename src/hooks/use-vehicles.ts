"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { VehicleDetailResponse, VehiclesResponse } from "@/lib/types/vehicle";

async function fetchVehicles(refresh = false): Promise<VehiclesResponse> {
  const url = refresh ? "/api/vehicles?refresh=1" : "/api/vehicles";
  const response = await fetch(url);
  if (!response.ok) throw new Error("차량 목록을 불러오지 못했습니다.");
  return response.json();
}

async function fetchVehicleDetail(id: string): Promise<VehicleDetailResponse> {
  const response = await fetch(`/api/vehicles/${id}`);
  if (!response.ok) throw new Error("차량 상세를 불러오지 못했습니다.");
  return response.json();
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: () => fetchVehicles(false),
  });
}

export function useVehicleRefresh() {
  const queryClient = useQueryClient();

  return async () => {
    await fetchVehicles(true);
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
