import { CalendarDays } from "lucide-react";

import { EmptyState, Pill, Stat } from "@/components/app/Common";
import { Calendar } from "@/components/ui/calendar";
import { stayDates, stayNights } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { useDayBoarding, useStays } from "@/lib/queries";
import { boardingCounts } from "@/lib/stats";
import type { Dog, StayRow } from "@/lib/types";

const STAY_STATUS: Record<
  StayRow["status"],
  { label: string; tone: "gray" | "brown" | "green" | "red" }
> = {
  scheduled: { label: "Upcoming", tone: "brown" },
  in_progress: { label: "Staying now", tone: "green" },
  completed: { label: "Completed", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function StayStatusPill({ status }: { status: StayRow["status"] }) {
  const s = STAY_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function BoardingPanel({ dog }: { dog: Dog }) {
  const { data: days = [] } = useDayBoarding([dog.id]);
  const { data: stays = [] } = useStays([dog.id]);
  const counts = boardingCounts(dog.id, days, stays);
  const toDate = (d: string) => new Date(`${d}T00:00:00`);
  const present = days.filter((d) => d.status === "present").map((d) => toDate(d.date));
  const scheduled = days.filter((d) => d.status === "scheduled").map((d) => toDate(d.date));
  const absent = days.filter((d) => d.status === "absent").map((d) => toDate(d.date));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Day boarding this month" value={counts.daysThisMonth} hint="days" />
        <Stat label="Day boarding all time" value={counts.daysAllTime} hint="days" />
        <Stat label="Home boarding this month" value={counts.nightsThisMonth} hint="nights" />
        <Stat label="Home boarding all time" value={counts.nightsAllTime} hint="nights" />
      </div>

      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <div className="rounded-2xl border bg-card p-2">
          <Calendar
            mode="multiple"
            selected={present}
            modifiers={{ scheduled, absent }}
            modifiersClassNames={{
              scheduled: "[&>button]:ring-2 [&>button]:ring-primary/50",
              absent: "[&>button]:line-through [&>button]:opacity-50",
            }}
          />
          <div className="flex flex-wrap gap-3 px-3 pb-2 text-xs text-muted-foreground">
            <span>Filled = attended</span>
            <span>Ring = booked</span>
            <span>Crossed = absent</span>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">Home boarding stays</h3>
          {stays.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-8" />} title="No stays yet" />
          ) : (
            [...stays].reverse().map((s) => {
              const { start, end } = stayDates(s);
              const n = stayNights(s);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
                >
                  <div>
                    <div className="font-medium">
                      {formatDate(start)} → {formatDate(end)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {n === 0 ? "Same-day stay" : `${n} night${n === 1 ? "" : "s"}`}
                      {s.status === "scheduled" ? " (tentative)" : ""}
                    </div>
                  </div>
                  <StayStatusPill status={s.status} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
