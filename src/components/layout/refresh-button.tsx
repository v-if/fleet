"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/shadcn/ui/button";
import { cn } from "@/lib/utils";

type RefreshButtonProps = {
  onClick: () => void;
  isRefreshing?: boolean;
  label?: string;
};

export function RefreshButton({
  onClick,
  isRefreshing = false,
  label = "새로고침",
}: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isRefreshing}
      className="gap-2"
    >
      <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
      {label}
    </Button>
  );
}
