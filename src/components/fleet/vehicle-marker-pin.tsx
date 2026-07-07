import type { VehicleStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import {
  STATUS_DOT_CLASS,
  STATUS_GLOW_CLASS,
  STATUS_RING_CLASS,
} from "@/lib/vehicle-status";

type VehicleMarkerPinProps = {
  plateNumber: string;
  status: VehicleStatus;
  batteryPercent: number | null;
  selected?: boolean;
  compact?: boolean;
  className?: string;
};

export function VehicleMarkerPin({
  plateNumber,
  status,
  batteryPercent,
  selected = false,
  compact = false,
  className,
}: VehicleMarkerPinProps) {
  const shortPlate = plateNumber.replace(/\s/g, "").slice(-4);
  const battery =
    batteryPercent != null ? `${Math.round(batteryPercent)}%` : "-";

  return (
    <div
      className={cn(
        "flex flex-col items-center transition-all duration-200",
        selected ? "scale-110" : "scale-100 hover:scale-105",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full border-2 border-white shadow-lg",
          STATUS_DOT_CLASS[status],
          STATUS_RING_CLASS[status],
          STATUS_GLOW_CLASS[status],
          selected ? "size-10 ring-4" : compact ? "size-7 ring-2" : "size-8 ring-2",
        )}
      >
        <span className="text-[10px] font-bold text-white drop-shadow">
          {shortPlate}
        </span>
      </div>
      {!compact ? (
        <div
          className={cn(
            "mt-1 rounded-full bg-zinc-900/85 px-2 py-0.5 text-[10px] font-medium text-white shadow",
            selected && "bg-primary",
          )}
        >
          {battery}
        </div>
      ) : null}
    </div>
  );
}
