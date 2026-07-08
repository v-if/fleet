import { Badge } from "@/components/shadcn/ui/badge";
import { cn } from "@/lib/utils";

type IssueTagProps = {
  label: string;
  variant?: "warning" | "alert" | "info";
  className?: string;
};

const variantMap = {
  warning: "warning" as const,
  alert: "error" as const,
  info: "info" as const,
};

export function IssueTag({ label, variant = "warning", className }: IssueTagProps) {
  return (
    <Badge variant={variantMap[variant]} className={cn("cursor-default font-normal", className)}>
      {label}
    </Badge>
  );
}
