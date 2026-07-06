import { Badge } from "@/components/ui/badge";

type AppHeaderProps = {
  title: string;
  description?: string;
  provider?: string;
  lastUpdatedAt?: string | null;
};

export function AppHeader({
  title,
  description,
  provider,
  lastUpdatedAt,
}: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b bg-background px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {provider ? (
          <span className="flex items-center gap-2">
            데이터 소스
            <Badge variant="outline">{provider}</Badge>
          </span>
        ) : null}
        {lastUpdatedAt ? (
          <span>
            마지막 업데이트{" "}
            <time className="font-medium text-foreground">
              {new Date(lastUpdatedAt).toLocaleString("ko-KR")}
            </time>
          </span>
        ) : null}
      </div>
    </header>
  );
}
