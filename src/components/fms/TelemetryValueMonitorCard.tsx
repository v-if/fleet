"use client";

type MonitorLine = {
  text: string;
  field: string;
  displayAt: string;
  value: string;
};

type TelemetryValueMonitorCardProps = {
  lines: MonitorLine[];
};

/** 개발용 — TelemetryIngress 최근 필드 줄 (요구1) */
export function TelemetryValueMonitorCard({ lines }: TelemetryValueMonitorCardProps) {
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10 lg:p-6">
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Telemetry 수신 로그 (개발)
            </h4>
            <span className="text-theme-xs text-amber-800/80 dark:text-amber-200/80">
              {lines.length > 0 ? `최근 ${lines.length}줄 · 클릭하여 펼침` : "수신 없음 · 클릭"}
            </span>
          </div>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            Asia/Seoul · TelemetryIngress 원문 · 펼친 필드 줄 최대 20
          </p>
        </summary>
        <div className="mt-4 border-t border-amber-200/80 pt-4 dark:border-amber-500/20">
          {lines.length === 0 ? (
            <p className="font-mono text-theme-sm text-gray-600 dark:text-gray-300">
              이 차량의 Telemetry 수신 이력이 없습니다.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-theme-sm text-gray-800 dark:text-gray-200">
              {lines.map((line, index) => (
                <li key={`${line.displayAt}-${line.field}-${index}`}>{line.text}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
