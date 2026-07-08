import { Badge } from "@/components/shadcn/ui/badge";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/breadcrumb";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type PageHeaderProps = {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  provider?: string;
  lastUpdatedAt?: string | null;
  countBadge?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
};

export function PageHeader({
  breadcrumbs,
  title,
  description,
  provider,
  lastUpdatedAt,
  countBadge,
  onRefresh,
  isRefreshing,
  actions,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 px-6 py-5 backdrop-blur-md">
      <div className="flex flex-col gap-4">
        {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              {countBadge ? (
                <Badge variant="secondary" className="font-normal">
                  {countBadge}
                </Badge>
              ) : null}
            </div>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {actions}
            <ThemeToggle />
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
            {onRefresh ? (
              <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
