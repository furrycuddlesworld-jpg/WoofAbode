import { createFileRoute, Navigate } from "@tanstack/react-router";

import { Loading } from "@/components/app/Common";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" />;
  return <Navigate to={isAdmin ? "/admin" : "/home"} />;
}
