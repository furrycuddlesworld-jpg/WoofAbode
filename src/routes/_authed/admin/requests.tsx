import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader, Pill } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { eachDate, formatDate } from "@/lib/dates";
import { useDogs } from "@/lib/queries";
import type { BookingRequest } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/requests")({
  head: () => pageHead("Booking requests", "Review boarding requests from WoofAbode pet parents."),
  component: RequestsPage,
});

function RequestsPage() {
  const queryClient = useQueryClient();
  const { data: dogs = [] } = useDogs();
  const { data = [] } = useQuery({
    queryKey: ["requests", "admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as BookingRequest[];
    },
  });
  const dogOf = (id: string) => dogs.find((d) => d.id === id);

  async function decide(r: BookingRequest, approve: boolean) {
    const dog = dogOf(r.dog_id);
    let adminNote: string | null = null;
    if (!approve) {
      adminNote =
        window.prompt("Reason (shown to the parent)", "Sorry, we're full on those dates.") ?? null;
    }
    if (approve) {
      const res =
        r.service === "home"
          ? await supabase.from("stays").insert({
              dog_id: r.dog_id,
              planned_start: r.start_date,
              planned_end: r.end_date,
              notes: r.note,
            })
          : await supabase.from("day_boarding").upsert(
              eachDate(r.start_date, r.end_date).map((date) => ({
                dog_id: r.dog_id,
                date,
                status: "scheduled",
              })),
              { onConflict: "dog_id,date", ignoreDuplicates: true },
            );
      if (res.error) return void toast.error(res.error.message);
    }
    const { error } = await supabase
      .from("booking_requests")
      .update({ status: approve ? "approved" : "declined", admin_note: adminNote })
      .eq("id", r.id);
    if (error) return void toast.error(error.message);
    if (dog?.owner_id) {
      await supabase.from("notifications").insert({
        user_id: dog.owner_id,
        title: `Booking ${approve ? "confirmed" : "declined"} for ${dog.name}`,
        body: `${formatDate(r.start_date)} to ${formatDate(r.end_date)}${adminNote ? ` · ${adminNote}` : ""}`,
        link: "/home",
      });
    }
    toast.success(approve ? "Approved and booked" : "Declined");
    queryClient.invalidateQueries({ queryKey: ["requests"] });
    queryClient.invalidateQueries({ queryKey: ["stays"] });
  }

  const tone = { pending: "amber", approved: "green", declined: "red" } as const;
  return (
    <>
      <PageHeader
        title="Booking requests"
        subtitle="Requests from parents. Approving one books it straight away."
      />
      {data.length === 0 ? <EmptyState title="No requests yet" /> : null}
      <div className="space-y-2">
        {data.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3"
          >
            <div className="flex-1">
              <div className="font-semibold">
                {dogOf(r.dog_id)?.name}: {r.service === "home" ? "Home boarding" : "Day boarding"}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(r.start_date)} → {formatDate(r.end_date)} · asked{" "}
                {formatDate(r.created_at.slice(0, 10))}
              </div>
              {r.note ? <div className="text-sm">"{r.note}"</div> : null}
            </div>
            <Pill tone={tone[r.status]}>{r.status}</Pill>
            {r.status === "pending" ? (
              <>
                <Button size="sm" onClick={() => decide(r, true)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(r, false)}>
                  Decline
                </Button>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
