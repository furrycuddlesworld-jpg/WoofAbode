import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, PawPrint } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const PARENT_NAV = [
  { to: "/home", label: "Home" },
  { to: "/dogs", label: "My dogs" },
  { to: "/bills", label: "Bills" },
  { to: "/profile", label: "Profile" },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "Today" },
  { to: "/admin/attendance", label: "Attendance" },
  { to: "/admin/schedule", label: "Schedule" },
  { to: "/admin/dogs", label: "Dogs" },
  { to: "/admin/people", label: "People" },
  { to: "/admin/bills", label: "Bills" },
  { to: "/admin/health", label: "Health" },
  { to: "/admin/requests", label: "Requests" },
  { to: "/admin/import", label: "Import" },
  { to: "/admin/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, profile, session, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = isAdmin ? ADMIN_NAV : PARENT_NAV;

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread", session?.user.id],
    enabled: Boolean(session),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to={isAdmin ? "/admin" : "/home"} className="flex items-center gap-2 font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <PawPrint className="size-5" />
            </span>
            <span className="text-lg">WoofAbode</span>
            {isAdmin ? (
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-semibold">
                Admin
              </span>
            ) : null}
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-accent"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </Link>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
              {profile?.full_name || profile?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
