"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  FlaskConical,
  Home,
  Menu,
  Moon,
  Sun,
  TableProperties,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingTour } from "@/components/onboarding-tour";
import { useTheme } from "@/components/theme-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workstation", label: "Workstation", icon: BrainCircuit },
  { href: "/research", label: "Research Mode", icon: TableProperties },
  { href: "/methodology", label: "Methodology", icon: FlaskConical }
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-panel shadow-workstation">
            <BarChart3 className="h-5 w-5 text-teal" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">Quant Committee AI</p>
            <p className="text-xs text-muted">Research Workstation</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1" aria-label="Primary">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                active ? "bg-panel text-teal" : "text-muted hover:bg-panel hover:text-text"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-6">
        <UserMenu />
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-ink text-text">
      <OnboardingTour />
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex" aria-label="Sidebar">
          <SidebarContent />
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close navigation menu"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="relative flex h-full w-[min(100%,18rem)] flex-col border-r border-line bg-surface px-4 py-6 shadow-workstation">
              <div className="mb-4 flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
              <p className="truncate text-sm text-muted lg:hidden">Quant Committee AI</p>
              <p className="hidden text-sm text-muted lg:block">Institutional quantitative research terminal</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="lg:hidden">
                <UserMenu />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}
