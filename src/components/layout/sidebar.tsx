"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Map, Settings, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/vehicles", label: "차량 목록", icon: List },
  { href: "/map", label: "지도", icon: Map },
  { href: "/settings", label: "연동 설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20">
            <Zap className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-sidebar-muted">
              Fleet FMS
            </p>
            <h1 className="text-base font-semibold">EV 관제</h1>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/15 text-white shadow-sm ring-1 ring-primary/30"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs text-sidebar-muted">
        Tesla · Deviceless MVP
      </div>
    </aside>
  );
}
