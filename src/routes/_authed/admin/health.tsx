import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, Loading, PageHeader, Pill } from "@/components/app/Common";
import { formatDate } from "@/lib/dates";
import { DUE_TONE, dueLabel, dueState, KIND_LABEL, latestRecords } from "@/lib/health";
import { useDogs, useHealth } from "@/lib/queries";

export const Route = createFileRoute("/_authed/admin/health")({
  staticData: { sitemap: false },
  head: () => pageHead("Health administration", "Review WoofAbode vaccinations and health records."),
  component: HealthDashboard,
});

function HealthDashboard() {
  const { data: dogs = [], isLoading } = useDogs();
  const active = dogs.filter((d) => d.active);
  const { data: health = [] } = useHealth(active.map((d) => d.id));
  const latest = latestRecords(health);
  const name = (id: string) => dogs.find((d) => d.id === id)?.name ?? "";

  const alerts = latest
    .filter((r) => ["overdue", "due_soon"].includes(dueState(r.next_due_date)))
    .sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? ""));
  const missing = active.flatMap((d) => {
    const kinds = new Set(latest.filter((r) => r.dog_id === d.id).map((r) => r.kind));
    const gaps = (["vaccination", "deworming"] as const).filter((k) => !kinds.has(k));
    return gaps.length ? [{ dog: d, gaps }] : [];
  });

  if (isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Health"
        subtitle="Vaccinations and deworming that need attention before a stay"
      />
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Overdue or due within 30 days</h2>
        {alerts.length === 0 ? <EmptyState title="Everyone is up to date" /> : null}
        <div className="space-y-2">
          {alerts.map((r) => (
            <Link
              key={r.id}
              to="/dogs/$dogId"
              params={{ dogId: r.dog_id }}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary"
            >
              <div className="flex-1">
                <div className="font-semibold">{name(r.dog_id)}</div>
                <div className="text-sm text-muted-foreground">
                  {KIND_LABEL[r.kind]}: {r.name} · due {formatDate(r.next_due_date)}
                </div>
              </div>
              <Pill tone={DUE_TONE[dueState(r.next_due_date)]}>{dueLabel(r.next_due_date)}</Pill>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Missing records</h2>
        {missing.length === 0 ? (
          <EmptyState title="All dogs have vaccination and deworming records" />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {missing.map(({ dog, gaps }) => (
            <Link
              key={dog.id}
              to="/dogs/$dogId"
              params={{ dogId: dog.id }}
              className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 hover:border-primary"
            >
              <span className="font-semibold">{dog.name}</span>
              <span className="text-sm text-muted-foreground">
                No {gaps.map((g) => KIND_LABEL[g].toLowerCase()).join(" or ")}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
