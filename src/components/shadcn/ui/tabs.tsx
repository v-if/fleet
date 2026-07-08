"use client";

import { createContext, useContext, useState } from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  onChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
};

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ value, onChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsListProps = {
  children: React.ReactNode;
  className?: string;
};

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-white/5",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  children: React.ReactNode;
};

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");

  const active = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

type TabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return (
    <div role="tabpanel" className={cn("mt-6", className)}>
      {children}
    </div>
  );
}
