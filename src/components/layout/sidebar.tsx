"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  List,
  Map,
  Settings,
  Zap,
} from "lucide-react";

import { useSidebar } from "@/components/providers/sidebar-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/fleet", label: "대시보드", icon: LayoutDashboard },
  { href: "/fleet/vehicles", label: "차량 목록", icon: List },
  { href: "/fleet/map", label: "지도", icon: Map },
  { href: "/fleet/settings", label: "연동 설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-56",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-4">
        <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "justify-center")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <Zap className="size-4 text-primary" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wider text-sidebar-muted uppercase">
                Fleet FMS
              </p>
              <h1 className="truncate text-base font-semibold">EV 관제</h1>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded-md p-1 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
            aria-label="사이드바 접기"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mt-2 rounded-md p-1 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
          aria-label="사이드바 펼치기"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : null}

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/fleet"
              ? pathname === "/fleet"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                active
                  ? "bg-primary/15 text-white shadow-sm ring-1 ring-primary/30"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      {!collapsed ? (
        <div className="border-t border-white/10 p-4 text-xs text-sidebar-muted">
          Tesla · Deviceless MVP
        </div>
      ) : null}
    </aside>
  );
}
