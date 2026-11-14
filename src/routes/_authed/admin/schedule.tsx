import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Home, Pencil, Sun, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StayStatusPill } from "@/components/app/BoardingPanel";
import { EmptyState, Field, PageHeader } from "@/components/app/Common";
import { StayActions } from "@/components/app/StayActions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { estimateStayAmount, stayDates, stayNights } from "@/lib/billing";
import { addDays, eachDate, formatDate, formatINR, todayIST } from "@/lib/dates";
import { useDogs, useRates, useSettings } from "@/lib/queries";
import type { DayBoarding, Dog, StayRow } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/schedule")({
  head: () => pageHead("Boarding schedule", "Manage WoofAbode day and home boarding bookings."),
  component: SchedulePage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useBookings() {
  return useQuery({
    queryKey: ["stays", "schedule"],
    queryFn: async () => {
      const today = todayIST();
      const [stays, days] = await Promise.all([
        supabase
          .from("stays")
          .select("*")
          .eq("imported", false)
          .in("status", ["scheduled", "in_progress"])
          .order("planned_start"),
        supabase.from("day_boarding").select("*").gte("date", today).order("date"),
      ]);
      return { stays: (stays.data ?? []) as StayRow[], days: (days.data ?? []) as DayBoarding[] };
    },
  });
}

/** Dogs booked on each date (day boarders not absent + home boarders). */
function headcountByDate(stays: StayRow[], days: DayBoarding[]): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (d: string) => counts.set(d, (counts.get(d) ?? 0) + 1);
  days.filter((d) => d.status !== "absent").forEach((d) => add(d.date));
  for (const s of stays) {
    const { start, end } = stayDates(s);
    eachDate(start, end).forEach(add);
  }
  return counts;
}

function SchedulePage() {
  const { data: dogs = [] } = useDogs();
  const { data } = useBookings();
  const { data: settings } = useSettings();
  const active = dogs.filter((d) => d.active);
  const dogById = new Map(dogs.map((d) => [d.id, d]));
  const stays = data?.stays ?? [];
  const days = data?.days ?? [];
  const counts = headcountByDate(stays, days);
  const limit = settings?.capacity_limit ?? 0;

  const overLimit = (dates: string[]) =>
    dates.filter((d) => limit && (counts.get(d) ?? 0) + 1 > limit);

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Book day boarding and home boarding. Parents see these under Upcoming boarding."
      />
      <Tabs defaultValue="home">
        <TabsList className="mb-4">
          <TabsTrigger value="home" className="gap-1.5">
            <Home className="size-4" /> Home boarding
          </TabsTrigger>
          <TabsTrigger value="day" className="gap-1.5">
            <Sun className="size-4" /> Day boarding
          </TabsTrigger>
        </TabsList>
        <TabsContent value="home">
          <HomeBookingForm dogs={active} overLimit={overLimit} />
        </TabsContent>
        <TabsContent value="day">
          <DayBookingForm dogs={active} overLimit={overLimit} />
        </TabsContent>
      </Tabs>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Upcoming and current home boarding</h2>
        {stays.length === 0 ? <EmptyState title="No home boarding booked" /> : null}
        <div className="space-y-2">
          {stays.map((s) => (
            <StayRowCard key={s.id} stay={s} dog={dogById.get(s.dog_id)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Upcoming day boarding</h2>
        <UpcomingDays days={days} dogById={dogById} />
      </section>
    </>
  );
}

function HomeBookingForm({
  dogs,
  overLimit,
}: {
  dogs: Dog[];
  overLimit: (dates: string[]) => string[];
}) {
  const queryClient = useQueryClient();
  const [dogId, setDogId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [override, setOverride] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const { data: rates = [] } = useRates(dogId ? [dogId] : []);

  const draft: StayRow | null =
    dogId && start && end && end >= start
      ? {
          id: "draft",
          dog_id: dogId,
          planned_start: start,
          planned_end: end,
          actual_start: null,
          actual_end: null,
          status: "scheduled",
          night_rate_override: override ? Number(override) : null,
          override_reason: null,
          notes: null,
          imported: false,
          imported_amount: null,
          imported_paid: null,
          created_at: "",
        }
      : null;
  const estimate = draft ? estimateStayAmount(draft, rates) : null;
  const clash = draft ? overLimit(eachDate(start, end)) : [];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return void toast.error("Pick a dog and valid dates.");
    if (override && !reason.trim()) return void toast.error("Add a reason for the special rate.");
    const { error } = await supabase.from("stays").insert({
      dog_id: dogId,
      planned_start: start,
      planned_end: end,
      night_rate_override: override ? Number(override) : null,
      override_reason: reason || null,
      notes: notes || null,
    });
    if (error) return void toast.error(error.message);
    const dog = dogs.find((d) => d.id === dogId);
    if (dog?.owner_id) {
      await supabase.from("notifications").insert({
        user_id: dog.owner_id,
        title: `Home boarding booked for ${dog.name}`,
        body: `${formatDate(start)} to ${formatDate(end)}`,
        link: "/home",
      });
    }
    toast.success("Home boarding booked");
    setStart("");
    setEnd("");
    setOverride("");
    setReason("");
    setNotes("");
    queryClient.invalidateQueries({ queryKey: ["stays"] });
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dog">
          <DogSelect dogs={dogs} value={dogId} onChange={setDogId} />
        </Field>
        <Field label="Tentative start">
          <Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Tentative end">
          <Input
            type="date"
            required
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <Field label="Special night rate (optional)" hint="Leave empty to use the dog's rate card">
          <Input
            type="number"
            min="0"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
        </Field>
        <Field label="Reason for special rate">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!override} />
        </Field>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {draft ? (
        <p className="rounded-xl bg-muted p-3 text-sm">
          {stayNights(draft) === 0
            ? "Same-day stay"
            : `${stayNights(draft)} night${stayNights(draft) === 1 ? "" : "s"}`}{" "}
          ·{" "}
          {estimate == null
            ? "No rate set for this dog yet (set it on the dog's Rates tab)"
            : `Estimated ${formatINR(estimate)}`}
        </p>
      ) : null}
      {clash.length ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Over your capacity limit on {clash.map(formatDate).join(", ")}.
        </p>
      ) : null}
      <Button type="submit">Book home boarding</Button>
    </form>
  );
}

function DayBookingForm({
  dogs,
  overLimit,
}: {
  dogs: Dog[];
  overLimit: (dates: string[]) => string[];
}) {
  const queryClient = useQueryClient();
  const [dogId, setDogId] = useState("");
  const [mode, setMode] = useState<"pattern" | "dates">("pattern");
  const [from, setFrom] = useState(todayIST());
  const [to, setTo] = useState(addDays(todayIST(), 30));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [picked, setPicked] = useState<Date[]>([]);

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dates =
    mode === "pattern"
      ? from && to && to >= from
        ? eachDate(from, to).filter((d) =>
            weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()),
          )
        : []
      : picked.map(toIso).sort();
  const clash = overLimit(dates);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dogId || dates.length === 0) return void toast.error("Pick a dog and at least one date.");
    const { error } = await supabase.from("day_boarding").upsert(
      dates.map((date) => ({ dog_id: dogId, date, status: "scheduled" })),
      { onConflict: "dog_id,date", ignoreDuplicates: true },
    );
    if (error) return void toast.error(error.message);
    const dog = dogs.find((d) => d.id === dogId);
    if (dog?.owner_id) {
      await supabase.from("notifications").insert({
        user_id: dog.owner_id,
        title: `Day boarding booked for ${dog.name}`,
        body: `${dates.length} day${dates.length === 1 ? "" : "s"} from ${formatDate(dates[0])}`,
        link: "/home",
      });
    }
    toast.success(`${dates.length} day${dates.length === 1 ? "" : "s"} booked`);
    setPicked([]);
    queryClient.invalidateQueries({ queryKey: ["stays"] });
    queryClient.invalidateQueries({ queryKey: ["day-boarding"] });
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dog">
          <DogSelect dogs={dogs} value={dogId} onChange={setDogId} />
        </Field>
        <Field label="How">
          <Select value={mode} onValueChange={(v) => setMode(v as "pattern" | "dates")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pattern">Repeat on weekdays</SelectItem>
              <SelectItem value="dates">Pick dates on a calendar</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {mode === "pattern" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((w, i) => (
              <label key={w} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={weekdays.includes(i)}
                  onCheckedChange={(v) =>
                    setWeekdays((cur) => (v ? [...cur, i] : cur.filter((x) => x !== i)))
                  }
                />
                {w}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-fit rounded-xl border">
          <Calendar mode="multiple" selected={picked} onSelect={(d) => setPicked(d ?? [])} />
        </div>
      )}
      <p className="rounded-xl bg-muted p-3 text-sm">
        {dates.length} day{dates.length === 1 ? "" : "s"} selected
        {dates.length ? ` (${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])})` : ""}
        . Days already booked are kept.
      </p>
      {clash.length ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Over your capacity limit on {clash.slice(0, 8).map(formatDate).join(", ")}
          {clash.length > 8 ? ` and ${clash.length - 8} more` : ""}.
        </p>
      ) : null}
      <Button type="submit">Book day boarding</Button>
    </form>
  );
}

function DogSelect({
  dogs,
  value,
  onChange,
}: {
  dogs: Dog[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choose a dog" />
      </SelectTrigger>
      <SelectContent>
        {dogs.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StayRowCard({ stay, dog }: { stay: StayRow; dog: Dog | undefined }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { start, end } = stayDates(stay);

  async function cancel() {
    if (!window.confirm(`Cancel ${dog?.name}'s stay?`)) return;
    const { error } = await supabase
      .from("stays")
      .update({ status: "cancelled" })
      .eq("id", stay.id);
    if (error) return void toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["stays"] });
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{dog?.name}</div>
          <div className="text-sm text-muted-foreground">
            {formatDate(start)} → {formatDate(end)} · {stayNights(stay)} night
            {stayNights(stay) === 1 ? "" : "s"}
            {stay.night_rate_override
              ? ` · special rate ${formatINR(Number(stay.night_rate_override))}`
              : ""}
          </div>
          {stay.notes ? <div className="text-sm">{stay.notes}</div> : null}
        </div>
        <StayStatusPill status={stay.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StayActions stay={stay} dog={dog} />
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Edit
        </Button>
        {stay.status === "scheduled" ? (
          <Button size="sm" variant="ghost" onClick={cancel}>
            <Trash2 className="size-4" /> Cancel
          </Button>
        ) : null}
      </div>
      <EditStay stay={stay} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

/** Edit tentative dates, or the actual start/end once a stay has started. */
function EditStay({
  stay,
  open,
  onOpenChange,
}: {
  stay: StayRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const toLocal = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [plannedStart, setPlannedStart] = useState(stay.planned_start);
  const [plannedEnd, setPlannedEnd] = useState(stay.planned_end);
  const [actualStart, setActualStart] = useState(toLocal(stay.actual_start));
  const [actualEnd, setActualEnd] = useState(toLocal(stay.actual_end));
  const [notes, setNotes] = useState(stay.notes ?? "");
  const [override, setOverride] = useState(stay.night_rate_override == null ? "" : String(stay.night_rate_override));
  const [reason, setReason] = useState(stay.override_reason ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("stays")
      .update({
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: actualStart ? new Date(actualStart).toISOString() : null,
        actual_end: actualEnd ? new Date(actualEnd).toISOString() : null,
        notes: notes || null,
        night_rate_override: override === "" ? null : Number(override),
        override_reason: reason || null,
      })
      .eq("id", stay.id);
    if (error) return void toast.error(error.message);
    toast.success("Stay updated. Recalculate the bill if one was already made.");
    queryClient.invalidateQueries({ queryKey: ["stays"] });
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit stay</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Special night rate (optional)">
              <Input aria-label="Special night rate" type="number" min="0" step="0.01" value={override} onChange={e => setOverride(e.target.value)} />
            </Field>
            <Field label="Reason for special rate">
              <Input value={reason} onChange={e => setReason(e.target.value)} />
            </Field>
            <Field label="Tentative start">
              <Input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </Field>
            <Field label="Tentative end">
              <Input
                type="date"
                min={plannedStart}
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </Field>
            {stay.status !== "scheduled" ? (
              <>
                <Field label="Actual start">
                  <Input
                    type="datetime-local"
                    value={actualStart}
                    onChange={(e) => setActualStart(e.target.value)}
                  />
                </Field>
                <Field label="Actual end">
                  <Input
                    type="datetime-local"
                    value={actualEnd}
                    onChange={(e) => setActualEnd(e.target.value)}
                  />
                </Field>
              </>
            ) : null}
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpcomingDays({ days, dogById }: { days: DayBoarding[]; dogById: Map<string, Dog> }) {
  const queryClient = useQueryClient();
  const upcoming = days.filter((d) => d.status === "scheduled");
  if (upcoming.length === 0) return <EmptyState title="No day boarding booked" />;
  const byDog = new Map<string, DayBoarding[]>();
  upcoming.forEach((d) => byDog.set(d.dog_id, [...(byDog.get(d.dog_id) ?? []), d]));

  async function remove(d: DayBoarding) {
    const { error } = await supabase.from("day_boarding").delete().eq("id", d.id);
    if (error) return void toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["stays"] });
  }

  return (
    <div className="space-y-3">
      {[...byDog.entries()].map(([dogId, list]) => (
        <div key={dogId} className="rounded-2xl border bg-card p-3">
          <div className="mb-2 font-semibold">
            {dogById.get(dogId)?.name} · {list.length} day{list.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {list.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => remove(d)}
                className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-destructive/15 hover:line-through"
                title="Tap to remove this day"
              >
                {formatDate(d.date)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Tap a date to remove it.</p>
    </div>
  );
}
