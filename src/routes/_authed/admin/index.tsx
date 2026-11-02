import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home, Sun } from "lucide-react";
import { useState } from "react";

import { StayStatusPill } from "@/components/app/BoardingPanel";
import { EmptyState, Loading, PageHeader, Stat } from "@/components/app/Common";
import { CheckInBoard } from "@/components/app/CheckInBoard";
import { DogAvatar } from "@/components/app/DogAvatar";
import { StayActions } from "@/components/app/StayActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { stayDates } from "@/lib/billing";
import { addDays, formatDate, formatMonth, isLastDayOfMonth, monthOf, todayIST } from "@/lib/dates";
import { useDogs, useSettings } from "@/lib/queries";
import type { DayBoarding, StayRow } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/")({
  component: TodayPage,
});

function TodayPage() {
  const [date, setDate] = useState(todayIST());
  const { data: dogs = [] } = useDogs();
  const { data: settings } = useSettings();
  const dogById = new Map(dogs.map((d) => [d.id, d]));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-day", date],
    queryFn: async () => {
      const [days, stays, toConfirm, requests] = await Promise.all([
        supabase.from("day_boarding").select("*").eq("date", date),
        // Stays that touch this date, using tentative or actual dates.
        supabase
          .from("stays")
          .select("*")
          .neq("status", "cancelled")
          .lte("planned_start", addDays(date, 60)),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "to_confirm"),
        supabase
          .from("booking_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      const allStays = (stays.data ?? []) as StayRow[];
      const here = allStays.filter((s) => {
        const { start, end } = stayDates(s);
        return (start <= date && date <= end) || (s.status === "in_progress" && start <= date);
      });
      return {
        days: (days.data ?? []) as DayBoarding[],
        stays: here,
        toConfirm: toConfirm.count ?? 0,
        requests: requests.count ?? 0,
      };
    },
  });

  const days = data?.days ?? [];
  const stays = data?.stays ?? [];
  const present = days.filter((d) => d.status === "present").length;
  const overnight = stays.filter((s) => {
    const { start, end } = stayDates(s);
    return start <= date && date < end;
  }).length;
  const capacity = settings?.capacity_limit ?? 0;
  const headcount = days.filter((d) => d.status !== "absent").length + stays.length;

  return (
    <>
      <PageHeader
        title={date === todayIST() ? "Today" : formatDate(date)}
        subtitle="Tap a dog when it arrives. Check home boarders in and out."
      />

      <div className="mb-5 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-auto"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
        {date !== todayIST() ? (
          <Button variant="ghost" onClick={() => setDate(todayIST())}>
            Today
          </Button>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Dogs here"
          value={headcount}
          hint={capacity ? `limit ${capacity}` : undefined}
        />
        <Stat label="Day boarders here" value={present} />
        <Stat label="Staying overnight" value={overnight} />
        <Link to="/admin/bills" className="block">
          <Stat
            label="To do"
            value={(data?.toConfirm ?? 0) + (data?.requests ?? 0)}
            hint={`${data?.toConfirm ?? 0} payments, ${data?.requests ?? 0} requests`}
          />
        </Link>
      </div>
      {capacity && headcount > capacity ? (
        <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {headcount} dogs on this day is over your limit of {capacity}.
        </p>
      ) : null}
      {isLastDayOfMonth(date) ? (
        <p className="mb-4 rounded-xl bg-accent p-3 text-sm">
          Last day of the month: tapping a day boarder updates their parent's{" "}
          {formatMonth(monthOf(date))} bill. Tap "Close {formatMonth(monthOf(date))}" when you're
          done to bill everyone else.
        </p>
      ) : null}

      {isLoading ? <Loading /> : null}

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Sun className="size-5 text-primary" /> Day boarding
        </h2>
        <CheckInBoard date={date} dogs={dogs} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Home className="size-5 text-primary" /> Home boarding
        </h2>
        {stays.length === 0 ? <EmptyState title="No home boarders on this day" /> : null}
        <div className="space-y-2">
          {stays.map((s) => {
            const dog = dogById.get(s.dog_id);
            const { start, end } = stayDates(s);
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3"
              >
                <DogAvatar
                  path={dog?.photo_path ?? null}
                  name={dog?.name ?? ""}
                  className="size-11"
                />
                <div className="flex-1">
                  <div className="font-semibold">{dog?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(start)} → {formatDate(end)}
                    {start === date ? " · arriving" : ""}
                    {end === date ? " · leaving" : ""}
                  </div>
                </div>
                <StayStatusPill status={s.status} />
                <StayActions stay={s} dog={dog} />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
