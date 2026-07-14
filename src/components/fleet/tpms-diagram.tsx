import { isLowTpms } from "@/lib/vehicle-status";
import { cn } from "@/lib/utils";

type TpmsDiagramProps = {
  frontLeft: number | null;
  frontRight: number | null;
  rearLeft: number | null;
  rearRight: number | null;
};

type TireCornerProps = {
  /** 좌측: 수치→타이어 / 우측: 타이어→수치 */
  side: "left" | "right";
  label: string;
  value: number | null;
  className?: string;
};

/**
 * 탑뷰 사이드 타이어 + PSI — sample-html/vehicle-sample.html 기준
 * 실내·실외·변속은 상단 3×2 퀵타일(CI-D)
 */
function TireCorner({ side, label, value, className }: TireCornerProps) {
  const low = isLowTpms(value);
  const hasValue = value != null;

  const tire = (
    <div
      className={cn(
        "flex h-10 w-4 shrink-0 items-center justify-center rounded border-x bg-gray-800 shadow-md dark:bg-gray-700",
        low ? "animate-pulse border-amber-500/80" : "border-gray-600",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "h-6 w-1 rounded-sm",
          low ? "bg-amber-400/60" : "bg-gray-400/60",
        )}
      />
    </div>
  );

  const reading = (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5",
        side === "left" ? "items-end" : "items-start",
      )}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          low
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-800 dark:text-white/90",
        )}
      >
        {hasValue ? Math.round(value) : "-"}
      </span>
      {hasValue ? (
        low ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 dark:bg-amber-500/15 dark:text-amber-400">
            주의
          </span>
        ) : (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400">
            정상
          </span>
        )
      ) : (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "absolute flex w-[100px] items-center gap-3",
        side === "left" ? "justify-end" : "justify-start",
        className,
      )}
      title={label}
    >
      {side === "left" ? (
        <>
          {reading}
          {tire}
        </>
      ) : (
        <>
          {tire}
          {reading}
        </>
      )}
    </div>
  );
}

export function TpmsDiagram({
  frontLeft,
  frontRight,
  rearLeft,
  rearRight,
}: TpmsDiagramProps) {
  return (
    <div className="relative mx-auto w-full max-w-[320px] select-none py-4 sm:py-6">
      <p className="mb-3 text-center text-xs text-muted-foreground sm:mb-4">단위: PSI</p>

      <div className="relative mx-auto min-h-[12.5rem] sm:min-h-[13.5rem]">
        {/* 차체 실루엣 — 앞유리·글래스 루프·보닛 라인 (sample) */}
        <div
          className="relative mx-auto h-48 w-24 border border-gray-200 bg-gray-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.05)] dark:border-gray-700 dark:bg-white/[0.06] dark:shadow-none"
          style={{ borderRadius: "30px 30px 20px 20px" }}
        >
          <div
            className="absolute top-[28px] right-1 left-1 h-12 border-t border-b border-gray-300/40 bg-slate-300/30 dark:border-gray-600/40 dark:bg-slate-400/20"
            style={{ borderRadius: "20px 20px 4px 4px" }}
          />
          <div
            className="absolute top-[82px] right-1 left-1 h-16 border-b border-gray-300/40 bg-slate-400/30 dark:border-gray-600/40 dark:bg-slate-500/20"
            style={{ borderRadius: "4px 4px 12px 12px" }}
          />
          <div className="absolute top-[14px] right-4 left-4 h-px bg-gray-200 dark:bg-gray-600" />
        </div>

        <TireCorner
          side="left"
          label="전좌"
          value={frontLeft}
          className="top-6 left-0"
        />
        <TireCorner
          side="right"
          label="전우"
          value={frontRight}
          className="top-6 right-0"
        />
        <TireCorner
          side="left"
          label="후좌"
          value={rearLeft}
          className="bottom-8 left-0"
        />
        <TireCorner
          side="right"
          label="후우"
          value={rearRight}
          className="right-0 bottom-8"
        />
      </div>
    </div>
  );
}
