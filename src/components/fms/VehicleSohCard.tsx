"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { ApexOptions } from "apexcharts";

import type { VehicleSohSummary } from "@/lib/vehicle-soh-rules";
import { SOH_MIN_SAMPLES_FOR_CHART } from "@/lib/vehicle-soh-rules";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

async function fetchSoh(vehicleId: string): Promise<VehicleSohSummary & { vehicleId: string }> {
  const response = await fetch(`/api/vehicles/${vehicleId}/soh`);
  if (!response.ok) {
    throw new Error("배터리 건강 데이터를 불러오지 못했습니다.");
  }
  return response.json();
}

function formatDelta(km: number | null, pct: number | null): string | null {
  if (km == null) return null;
  const sign = km > 0 ? "+" : "";
  const pctPart = pct != null ? ` (${sign}${pct}%)` : "";
  return `${sign}${km.toLocaleString("ko-KR")} km${pctPart}`;
}

type VehicleSohCardProps = {
  vehicleId: string;
};

export function VehicleSohCard({ vehicleId }: VehicleSohCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vehicles", vehicleId, "soh"],
    queryFn: () => fetchSoh(vehicleId),
    enabled: Boolean(vehicleId),
  });

  const chartSamples = (data?.samples ?? []).filter((s) => !s.outlier);
  const showChart =
    Boolean(data?.chartReady) &&
    chartSamples.length >= SOH_MIN_SAMPLES_FOR_CHART;

  const categories = chartSamples.map((s) =>
    new Date(s.at).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }),
  );
  const seriesData = chartSamples.map((s) => Math.round(s.rangeKm));

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      height: 220,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#465FFF"],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { opacityFrom: 0.45, opacityTo: 0.05 },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4,
    },
    xaxis: {
      categories,
      labels: {
        style: { colors: "#9CA3AF", fontSize: "11px" },
        rotate: categories.length > 8 ? -45 : 0,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9CA3AF", fontSize: "11px" },
        formatter: (v) => `${Math.round(v)}`,
      },
      title: {
        text: "km",
        style: { color: "#9CA3AF", fontSize: "11px" },
      },
    },
    tooltip: {
      y: {
        formatter: (v) => `${v} km`,
      },
    },
    markers: {
      size: 3,
      strokeWidth: 0,
    },
  };

  const deltaText = formatDelta(
    data?.delta90dKm ?? null,
    data?.delta90dPercent ?? null,
  );

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
        배터리 건강 (추정)
      </h4>
      <p className="mb-3 text-theme-xs text-gray-500">
        충전 한도 도달 시 잔여 주행거리 추이
      </p>

      {isLoading ? (
        <p className="py-6 text-theme-sm text-gray-400">불러오는 중…</p>
      ) : isError ? (
        <p className="py-6 text-theme-sm text-error-600">
          데이터를 불러오지 못했습니다.
        </p>
      ) : !showChart ? (
        <p className="py-6 text-theme-sm text-gray-400">
          한도 도달 충전이 더 쌓이면 추이를 표시합니다. (최소{" "}
          {SOH_MIN_SAMPLES_FOR_CHART}회)
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-theme-sm">
            {data?.latest ? (
              <span className="font-medium text-gray-800 dark:text-white/90">
                최근 한도 도달 시{" "}
                {Math.round(data.latest.rangeKm).toLocaleString("ko-KR")} km
              </span>
            ) : null}
            {deltaText ? (
              <span
                className={
                  (data?.delta90dKm ?? 0) < 0
                    ? "text-warning-700 dark:text-warning-300"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                비교 대비 {deltaText}
              </span>
            ) : null}
          </div>
          <div className="w-full">
            <ReactApexChart
              options={options}
              series={[{ name: "잔여 km", data: seriesData }]}
              type="area"
              height={220}
            />
          </div>
        </>
      )}

      <p className="mt-3 text-theme-xs text-gray-400">
        {data?.notice ??
          "Telemetry 추정입니다. 제조사 SOH와 다를 수 있습니다."}
      </p>
    </section>
  );
}
