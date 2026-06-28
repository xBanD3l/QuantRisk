"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  FlaskConical,
  Home,
  Moon,
  Sun,
  TableProperties
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workstation", label: "Workstation", icon: BrainCircuit },
  { href: "/research", label: "Research Mode", icon: TableProperties },
  { href: "/methodology", label: "Methodology", icon: FlaskConical }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-ink text-text">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
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

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                    active ? "bg-panel text-teal" : "text-muted hover:bg-panel hover:text-text"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-line pt-6">
            <UserMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                    pathname === item.href ? "bg-panel text-teal" : "text-muted"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <p className="hidden text-sm text-muted lg:block">Institutional quantitative research terminal</p>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <UserMenu />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
