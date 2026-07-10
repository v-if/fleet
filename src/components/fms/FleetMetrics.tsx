"use client";

import Badge from "@/components/ui/badge/Badge";
import {
  AlertIcon,
  BoltIcon,
  BoxIconLine,
  CheckCircleIcon,
  GroupIcon,
  TimeIcon,
} from "@/icons";
import type { VehiclesResponse } from "@/lib/types/vehicle";
import { FMS_NAME } from "@/lib/branding";

type FleetMetricsProps = {
  summary: VehiclesResponse["summary"];
  className?: string;
};

type MetricKey = keyof VehiclesResponse["summary"];

type MetricConfig = {
  key: MetricKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: "primary" | "success" | "error" | "warning" | "info" | "light" | "dark";
};

const metrics: MetricConfig[] = [
  {
    key: "total",
    label: "전체 차량",
    icon: GroupIcon,
    badgeColor: "info",
  },
  {
    key: "online",
    label: "정상",
    icon: CheckCircleIcon,
    badgeColor: "success",
  },
  {
    key: "charging",
    label: "충전중",
    icon: BoltIcon,
    badgeColor: "info",
  },
  {
    key: "warning",
    label: "주의",
    icon: AlertIcon,
    badgeColor: "warning",
  },
  {
    key: "alert",
    label: "이상",
    icon: AlertIcon,
    badgeColor: "error",
  },
  {
    key: "idle",
    label: "미운행",
    icon: TimeIcon,
    badgeColor: "light",
  },
];

function toPercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function FleetMetrics({ summary, className }: FleetMetricsProps) {
  return (
    <div className={`grid h-full grid-cols-2 gap-3 sm:gap-4 ${className ?? ""}`}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const value = summary[metric.key];
        const percent = toPercent(value, summary.total);

        return (
          <div
            key={metric.key}
            className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 sm:h-11 sm:w-11">
                <Icon className="size-5 text-gray-800 dark:text-white/90 sm:size-6" />
              </div>
              <span className="text-theme-sm font-medium text-gray-500 dark:text-gray-400">
                {metric.label}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white/90 sm:text-title-sm">
                {value}
              </h4>
              {metric.key === "total" ? (
                <Badge color="info">
                  <BoxIconLine className="size-3" />
                  {FMS_NAME}
                </Badge>
              ) : (
                <Badge color={metric.badgeColor}>{percent}%</Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
