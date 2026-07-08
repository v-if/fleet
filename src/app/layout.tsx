import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";
import "flatpickr/dist/flatpickr.css";

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fleet FMS",
  description: "차량 관제 시스템 — TailAdmin UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>
            <QueryProvider>{children}</QueryProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
