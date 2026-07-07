import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IssueTagProps = {
  label: string;
  variant?: "warning" | "alert" | "info";
  className?: string;
};

const variantClass = {
  warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  alert: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  info: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
};

export function IssueTag({ label, variant = "warning", className }: IssueTagProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-default font-normal transition-colors",
        variantClass[variant],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
