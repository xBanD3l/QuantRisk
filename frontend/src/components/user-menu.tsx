"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  TableProperties
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/?tab=analyses", label: "Saved Analyses", icon: TableProperties },
  { href: "/?tab=portfolios", label: "Portfolios", icon: FolderKanban },
  { href: "/?tab=reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function UserMenu() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "User";
  const email = profile?.email ?? user?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="h-9 animate-pulse rounded-md bg-panel2" />
      </div>
    );
  }

  if (!user) {
    return (
      <Button type="button" className="w-full" onClick={() => void signInWithGoogle()}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Sign in with Google
      </Button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel p-3 text-left transition hover:border-teal/40"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-xs font-semibold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted">{email}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-workstation"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted transition hover:bg-panel hover:text-text"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-sm text-muted transition hover:bg-panel hover:text-text"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
