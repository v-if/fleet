"use client";

import {
  AlertCircle,
  AlertTriangle,
  BatteryCharging,
  Car,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/shadcn/ui/card";
import { cn } from "@/lib/utils";

type KpiSummary = {
  total: number;
  online: number;
  warning: number;
  alert: number;
  offline: number;
  idle: number;
  charging: number;
};

type KpiCardsProps = {
  summary: KpiSummary;
};

const items: {
  key: keyof KpiSummary;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}[] = [
  {
    key: "total",
    label: "전체",
    icon: Car,
    iconBg: "bg-gray-100 dark:bg-white/10",
    iconColor: "text-gray-600 dark:text-gray-300",
    valueColor: "text-foreground",
  },
  {
    key: "online",
    label: "정상",
    icon: CheckCircle2,
    iconBg: "bg-success-50 dark:bg-success-500/15",
    iconColor: "text-success-600 dark:text-success-500",
    valueColor: "text-success-600 dark:text-success-500",
  },
  {
    key: "charging",
    label: "충전중",
    icon: BatteryCharging,
    iconBg: "bg-info-50 dark:bg-info-500/15",
    iconColor: "text-info-600 dark:text-info-500",
    valueColor: "text-info-600 dark:text-info-500",
  },
  {
    key: "warning",
    label: "주의",
    icon: AlertTriangle,
    iconBg: "bg-warning-50 dark:bg-warning-500/15",
    iconColor: "text-warning-600 dark:text-warning-500",
    valueColor: "text-warning-600 dark:text-warning-500",
  },
  {
    key: "alert",
    label: "이상",
    icon: AlertCircle,
    iconBg: "bg-error-50 dark:bg-error-500/15",
    iconColor: "text-error-600 dark:text-error-500",
    valueColor: "text-error-600 dark:text-error-500",
  },
  {
    key: "idle",
    label: "미운행",
    icon: Clock,
    iconBg: "bg-gray-100 dark:bg-white/10",
    iconColor: "text-gray-500 dark:text-gray-400",
    valueColor: "text-gray-600 dark:text-gray-300",
  },
];

export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        const value = summary[item.key];

        return (
          <Card
            key={item.key}
            className="fleet-card-hover transition-all duration-200 hover:-translate-y-0.5"
          >
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="space-y-3">
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full",
                    item.iconBg,
                  )}
                >
                  <Icon className={cn("size-5", item.iconColor)} />
                </div>
                <div>
                  <p className="text-theme-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p
                    className={cn(
                      "text-title-sm font-bold tabular-nums leading-none",
                      item.valueColor,
                    )}
                  >
                    {value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
