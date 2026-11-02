import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { Loading } from "@/components/app/Common";
import { isSupabaseConfigured } from "@/integrations/supabase/configured";
import { useAuth } from "@/lib/auth";

// Every page inside this layout needs a signed-in user. Pages under /admin also need the admin role.
export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading, session, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Backend not connected yet</h1>
        <p className="mt-2 text-muted-foreground">
          Enable Lovable Cloud for this project to turn on logins and the database.
        </p>
      </div>
    );
  }
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" />;
  if (pathname.startsWith("/admin") && !isAdmin) return <Navigate to="/home" />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
