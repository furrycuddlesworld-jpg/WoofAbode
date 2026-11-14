import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Loading, PageHeader, Pill } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAge } from "@/lib/dates";
import { todayIST } from "@/lib/dates";
import { rateOn } from "@/lib/billing";
import { DUE_TONE, dueState, latestRecords } from "@/lib/health";
import { useDogs, useHealth, useProfiles, useRates } from "@/lib/queries";

export const Route = createFileRoute("/_authed/admin/dogs")({
  head: () => pageHead("Dog administration", "Manage WoofAbode dogs, health alerts and individual rates."),
  component: AdminDogs,
});

function AdminDogs() {
  const { data: dogs = [], isLoading } = useDogs();
  const { data: profiles = [] } = useProfiles();
  const ids = dogs.map((d) => d.id);
  const { data: health = [] } = useHealth(ids);
  const { data: rates = [] } = useRates(ids);
  const [q, setQ] = useState("");
  const owner = (id: string | null) => profiles.find((p) => p.id === id);
  const latest = latestRecords(health);
  const shown = dogs.filter((d) => {
    const o = owner(d.owner_id);
    return `${d.name} ${d.breed ?? ""} ${o?.full_name ?? ""} ${o?.email ?? ""} ${d.pending_owner_email ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase());
  });

  return (
    <>
      <PageHeader
        title="Dogs"
        subtitle={`${dogs.filter((d) => d.active).length} active dogs`}
        actions={
          <Button asChild>
            <Link to="/dogs/new">
              <Plus className="size-4" /> Add a dog
            </Link>
          </Button>
        }
      />
      <Input
        placeholder="Search by dog or parent"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      {isLoading ? <Loading /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((d) => {
          const o = owner(d.owner_id);
          const recs = latest.filter((r) => r.dog_id === d.id);
          const worst = recs.some((r) => dueState(r.next_due_date) === "overdue")
            ? "overdue"
            : recs.some((r) => dueState(r.next_due_date) === "due_soon")
              ? "due_soon"
              : recs.length
                ? "ok"
                : "none";
          const hasRates = (d.service_type === "home" || rateOn(rates, d.id, todayIST(), "day_rate") != null) && (d.service_type === "day" || rateOn(rates, d.id, todayIST(), "night_rate") != null);
          return (
            <Link
              key={d.id}
              to="/dogs/$dogId"
              params={{ dogId: d.id }}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary"
            >
              <DogAvatar path={d.photo_path} name={d.name} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {d.name}{" "}
                  {!d.active ? (
                    <span className="text-xs text-muted-foreground">(inactive)</span>
                  ) : null}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {[d.breed, formatAge(d.date_of_birth)].filter(Boolean).join(" · ")}
                </div>
                <div className="truncate text-sm">
                  {o
                    ? o.full_name || o.email
                    : d.pending_owner_email
                      ? `${d.pending_owner_email} (invited)`
                      : "No parent linked"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Pill tone={DUE_TONE[worst]}>
                  {worst === "overdue"
                    ? "Vaccine overdue"
                    : worst === "due_soon"
                      ? "Due soon"
                      : worst === "ok"
                        ? "Vaccines OK"
                        : "No records"}
                </Pill>
                {!hasRates ? <Pill tone="amber">No rates</Pill> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
