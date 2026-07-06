import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KpiCardsProps = {
  summary: {
    total: number;
    online: number;
    warning: number;
    alert: number;
    offline: number;
    idle: number;
  };
};

const items = [
  { key: "total", label: "전체", className: "text-foreground" },
  { key: "online", label: "정상", className: "text-emerald-600" },
  { key: "warning", label: "주의", className: "text-amber-600" },
  { key: "alert", label: "이상", className: "text-red-600" },
  { key: "idle", label: "미운행", className: "text-zinc-500" },
] as const;

export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent className={`text-3xl font-semibold ${item.className}`}>
            {summary[item.key]}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
