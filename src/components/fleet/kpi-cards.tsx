import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardsProps = {
  summary: {
    total: number;
    online: number;
    warning: number;
    alert: number;
    offline: number;
    idle: number;
    charging: number;
  };
};

const items = [
  { key: "total", label: "전체", className: "text-foreground" },
  { key: "online", label: "정상", className: "text-emerald-600" },
  { key: "charging", label: "충전중", className: "text-blue-600" },
  { key: "warning", label: "주의", className: "text-amber-600" },
  { key: "alert", label: "이상", className: "text-red-600" },
  { key: "idle", label: "미운행", className: "text-zinc-500" },
] as const;

export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <Card
          key={item.key}
          className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-3xl font-bold tabular-nums", item.className)}>
              {summary[item.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
