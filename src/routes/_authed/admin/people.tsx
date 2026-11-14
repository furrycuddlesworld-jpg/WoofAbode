import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Loading, PageHeader, Pill } from "@/components/app/Common";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { useDogs, useProfiles } from "@/lib/queries";
import type { AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/people")({
  staticData: { sitemap: false },
  head: () => pageHead("Pet parents", "Manage WoofAbode pet parent accounts and approvals."),
  component: PeoplePage,
});

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  client: "Client",
  user: "User (not approved)",
};
const ROLE_TONE = { admin: "brown", client: "green", user: "amber" } as const;

function PeoplePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: dogs = [] } = useDogs();
  const [q, setQ] = useState("");
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []) as { user_id: string; role: AppRole }[];
    },
  });
  const roleOf = (id: string): AppRole => {
    const owned = roles.filter((r) => r.user_id === id).map((r) => r.role);
    return owned.includes("admin") ? "admin" : owned.includes("client") ? "client" : "user";
  };

  async function changeRole(userId: string, role: AppRole) {
    if (userId === session?.user.id && role !== "admin") {
      if (!window.confirm("You are removing your own admin access. Continue?")) return;
    }
    // One role per person: add the new one, then remove the others.
    const add = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (add.error) return void toast.error(add.error.message);
    const del = await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", role);
    if (del.error) return void toast.error(del.error.message);
    if (role === "client") {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Your WoofAbode account is approved",
        body: "You can now see bookings, bills and request boarding.",
        link: "/home",
      });
    }
    toast.success(`Changed to ${ROLE_LABEL[role]}`);
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  const shown = profiles
    .filter((p) =>
      `${p.full_name} ${p.email} ${p.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => (roleOf(a.id) === "user" ? -1 : 0) - (roleOf(b.id) === "user" ? -1 : 0));
  const waiting = profiles.filter((p) => roleOf(p.id) === "user").length;

  return (
    <>
      <PageHeader
        title="People"
        subtitle={waiting ? `${waiting} waiting for approval` : "Everyone who has signed up"}
      />
      <Input
        placeholder="Search name, email or phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      {isLoading ? <Loading /> : null}
      <div className="space-y-2">
        {shown.map((p) => {
          const role = roleOf(p.id);
          const theirDogs = dogs.filter((d) => d.owner_id === p.id);
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {p.full_name || "(no name)"}{" "}
                  <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill>
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {p.email} · joined {formatDate(p.created_at.slice(0, 10))}
                </div>
                <div className="text-sm">
                  {theirDogs.length
                    ? theirDogs.map((d, i) => (
                        <span key={d.id}>
                          {i ? ", " : ""}
                          <Link
                            to="/dogs/$dogId"
                            params={{ dogId: d.id }}
                            className="text-primary underline"
                          >
                            {d.name}
                          </Link>
                        </span>
                      ))
                    : "No dogs yet"}
                </div>
              </div>
              {p.phone ? (
                <a
                  href={`tel:${p.phone}`}
                  className="inline-flex items-center gap-1 text-sm text-primary"
                >
                  <Phone className="size-4" /> {p.phone}
                </a>
              ) : null}
              <Select value={role} onValueChange={(v) => changeRole(p.id, v as AppRole)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (not approved)</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </>
  );
}
