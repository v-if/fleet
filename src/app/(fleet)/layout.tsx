import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider as FleetThemeProvider } from "@/components/providers/theme-provider";

export default function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FleetThemeProvider>
      <AppShell>{children}</AppShell>
    </FleetThemeProvider>
  );
}
