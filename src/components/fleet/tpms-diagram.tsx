import { isLowTpms } from "@/lib/vehicle-status";
import { cn } from "@/lib/utils";

type TpmsDiagramProps = {
  frontLeft: number | null;
  frontRight: number | null;
  rearLeft: number | null;
  rearRight: number | null;
  /** true면 다이어그램 안 칩 숨김 — 카드 헤더(우측 상단)에서 표시 */
  hideInlineAlert?: boolean;
};

type Corner = "fl" | "fr" | "rl" | "rr";

type TireCornerProps = {
  side: "left" | "right";
  corner: Corner;
  label: string;
  value: number | null;
  className?: string;
};

const CORNER_LABEL: Record<Corner, string> = {
  fl: "전좌",
  fr: "전우",
  rl: "후좌",
  rr: "후우",
};

/** 카드 헤더 우측 알림 문구 (예: 「후좌측 압력 저하」) */
export function buildTpmsPressureAlertLabel(
  frontLeft: number | null,
  frontRight: number | null,
  rearLeft: number | null,
  rearRight: number | null,
): string | null {
  const lows = (
    [
      isLowTpms(frontLeft) ? "fl" : null,
      isLowTpms(frontRight) ? "fr" : null,
      isLowTpms(rearLeft) ? "rl" : null,
      isLowTpms(rearRight) ? "rr" : null,
    ] as const
  ).filter((c): c is Corner => c != null);
  if (lows.length === 0) return null;
  if (lows.length === 1) return `${CORNER_LABEL[lows[0]]}측 압력 저하`;
  if (lows.length >= 3) return "다중 타이어 압력 저하";
  return `${lows.map((c) => CORNER_LABEL[c]).join("·")} 압력 저하`;
}

export function TpmsAlertChip({ label }: { label: string }) {
  return (
    <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      {label}
    </span>
  );
}

/**
 * 탑뷰 TPMS — sample-html/vehicle-sample4.html
 * 화이트·실버 차체 · 트레드 휠 · SVG 가이드
 */
function TreadTire({ low }: { low: boolean }) {
  return (
    <div
      className={cn(
        "flex h-12 w-4 shrink-0 flex-col items-center justify-between rounded border-y py-0.5 shadow-md",
        low
          ? "animate-pulse border border-rose-500 bg-slate-800 shadow-lg shadow-rose-100 dark:shadow-rose-500/20"
          : "border-slate-700 bg-slate-800 dark:border-slate-600",
      )}
      aria-hidden
    >
      <span
        className={cn(
          "h-px w-full",
          low ? "bg-rose-500/30" : "bg-slate-600/50",
        )}
      />
      <div
        className={cn(
          "flex h-5 w-2 items-center justify-center rounded-sm",
          low
            ? "bg-gradient-to-r from-rose-950 to-rose-900"
            : "bg-gradient-to-r from-slate-500 to-slate-400",
        )}
      >
        <span
          className={cn(
            "h-3 w-1 rounded-full",
            low ? "animate-ping bg-rose-400" : "bg-emerald-400/40",
          )}
        />
      </div>
      <span
        className={cn(
          "h-px w-full",
          low ? "bg-rose-500/30" : "bg-slate-600/50",
        )}
      />
    </div>
  );
}

function TireCorner({ side, corner, label, value, className }: TireCornerProps) {
  const low = isLowTpms(value);
  const hasValue = value != null;

  const tire = <TreadTire low={low} />;

  const reading = (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        side === "left" ? "items-end" : "items-start",
      )}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "text-sm leading-none font-black tabular-nums",
          low
            ? "text-rose-500 dark:text-rose-400"
            : "text-gray-800 dark:text-white/90",
        )}
      >
        {hasValue ? Math.round(value) : "-"}
      </span>
      {hasValue ? (
        low ? (
          <span className="mt-1 rounded border border-rose-100 bg-rose-50 px-1 text-[9px] font-bold text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400">
            주의
          </span>
        ) : (
          <span className="mt-1 rounded border border-emerald-100 bg-emerald-50 px-1 text-[9px] font-bold text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
            정상
          </span>
        )
      ) : (
        <span className="mt-1 text-[9px] text-muted-foreground">{label}</span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "absolute flex w-[105px] items-center gap-3",
        side === "left" ? "justify-end" : "justify-start",
        className,
      )}
      title={label}
      data-tpms-corner={corner}
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

function GuideLines({
  flLow,
  frLow,
  rlLow,
  rrLow,
}: {
  flLow: boolean;
  frLow: boolean;
  rlLow: boolean;
  rrLow: boolean;
}) {
  const normal = "#CBD5E1";
  const alert = "#f43f5e";
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <line
        x1="104"
        y1="56"
        x2="124"
        y2="56"
        stroke={flLow ? alert : normal}
        strokeWidth={1.2}
        strokeDasharray="2 2"
        className={flLow ? "tpms-guide-alert" : undefined}
      />
      <line
        x1="196"
        y1="56"
        x2="216"
        y2="56"
        stroke={frLow ? alert : normal}
        strokeWidth={1.2}
        strokeDasharray="2 2"
        className={frLow ? "tpms-guide-alert" : undefined}
      />
      <line
        x1="104"
        y1="196"
        x2="124"
        y2="196"
        stroke={rlLow ? alert : normal}
        strokeWidth={1.2}
        strokeDasharray="2 2"
        className={rlLow ? "tpms-guide-alert" : undefined}
      />
      <line
        x1="196"
        y1="196"
        x2="216"
        y2="196"
        stroke={rrLow ? alert : normal}
        strokeWidth={1.2}
        strokeDasharray="2 2"
        className={rrLow ? "tpms-guide-alert" : undefined}
      />
    </svg>
  );
}

function VehicleBodySilhouette() {
  return (
    <div
      className="relative mx-auto h-56 w-[6.5rem] border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 shadow-[inset_0_3px_6px_rgba(255,255,255,0.9),0_12px_24px_-8px_rgba(15,23,42,0.15)] dark:border-slate-600 dark:from-slate-600/90 dark:to-slate-700 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),0_12px_24px_-8px_rgba(0,0,0,0.4)]"
      style={{ borderRadius: "36px 36px 24px 24px" }}
    >
      {/* 사이드 미러 */}
      <div
        className="absolute top-16 -left-2.5 h-3 w-2.5 rounded-l-full border border-r-0 border-slate-400/60 bg-slate-300 shadow-sm dark:border-slate-500 dark:bg-slate-500"
        aria-hidden
      />
      <div
        className="absolute top-16 -right-2.5 h-3 w-2.5 rounded-r-full border border-l-0 border-slate-400/60 bg-slate-300 shadow-sm dark:border-slate-500 dark:bg-slate-500"
        aria-hidden
      />

      {/* 헤드라이트 */}
      <div
        className="absolute top-[3px] left-2.5 h-1 w-3 rounded-full bg-amber-200 opacity-70 dark:bg-amber-300/50"
        aria-hidden
      />
      <div
        className="absolute top-[3px] right-2.5 h-1 w-3 rounded-full bg-amber-200 opacity-70 dark:bg-amber-300/50"
        aria-hidden
      />

      {/* 앞유리 */}
      <div
        className="absolute top-[34px] right-1.5 left-1.5 h-11 border-t border-b border-white/40 bg-gradient-to-b from-slate-400/20 to-slate-500/40 shadow-inner dark:border-white/10 dark:from-slate-400/25 dark:to-slate-600/45"
        style={{ borderRadius: "20px 20px 4px 4px" }}
        aria-hidden
      />

      {/* 파노라마 글래스 루프 + 센터 바 */}
      <div
        className="absolute top-[88px] right-1.5 left-1.5 flex h-20 items-center justify-center border-b border-white/30 bg-gradient-to-b from-slate-500/40 to-slate-600/50 dark:border-white/10 dark:from-slate-500/45 dark:to-slate-700/55"
        style={{ borderRadius: "4px 4px 16px 16px" }}
        aria-hidden
      >
        <div className="h-full w-px bg-white/20" />
      </div>

      {/* 보닛 라인 */}
      <div
        className="absolute top-[18px] right-6 left-6 h-[1.5px] bg-slate-300/80 dark:bg-slate-500/70"
        aria-hidden
      />

      {/* 테일램프 */}
      <div
        className="absolute right-3 bottom-[2px] left-3 h-[2.5px] rounded-full bg-red-500 opacity-80 shadow-[0_1px_3px_rgba(239,68,68,0.4)]"
        aria-hidden
      />
    </div>
  );
}

export function TpmsDiagram({
  frontLeft,
  frontRight,
  rearLeft,
  rearRight,
  hideInlineAlert = false,
}: TpmsDiagramProps) {
  const flLow = isLowTpms(frontLeft);
  const frLow = isLowTpms(frontRight);
  const rlLow = isLowTpms(rearLeft);
  const rrLow = isLowTpms(rearRight);
  const alertLabel = buildTpmsPressureAlertLabel(
    frontLeft,
    frontRight,
    rearLeft,
    rearRight,
  );

  return (
    <div className="relative mx-auto w-full max-w-[320px] select-none py-4">
      {!hideInlineAlert && alertLabel ? (
        <div className="mb-4 flex justify-end">
          <TpmsAlertChip label={alertLabel} />
        </div>
      ) : null}
      <p className="mb-4 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
        단위: PSI
      </p>

      <div className="relative mx-auto min-h-[15.5rem] sm:min-h-[16rem]">
        <VehicleBodySilhouette />
        <GuideLines flLow={flLow} frLow={frLow} rlLow={rlLow} rrLow={rrLow} />

        <TireCorner
          side="left"
          corner="fl"
          label="전좌"
          value={frontLeft}
          className="top-7 left-1"
        />
        <TireCorner
          side="right"
          corner="fr"
          label="전우"
          value={frontRight}
          className="top-7 right-1"
        />
        <TireCorner
          side="left"
          corner="rl"
          label="후좌"
          value={rearLeft}
          className="bottom-7 left-1"
        />
        <TireCorner
          side="right"
          corner="rr"
          label="후우"
          value={rearRight}
          className="right-1 bottom-7"
        />
      </div>
    </div>
  );
}
