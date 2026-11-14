import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarPlus,
  Dog as DogIcon,
  Home,
  Plus,
  Receipt,
  Sun,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StayStatusPill } from "@/components/app/BoardingPanel";
import { EmptyState, Field, Loading, Pill } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { estimateStayAmount, stayDates, stayNights } from "@/lib/billing";
import { formatDate, formatINR, formatMonth, todayIST } from "@/lib/dates";
import { DUE_TONE, dueLabel, dueState, latestRecords } from "@/lib/health";
import { useBills, useDayBoarding, useDogs, useHealth, useRates, useStays } from "@/lib/queries";
import { boardingCounts, upcoming } from "@/lib/stats";
import type { BookingRequest, Dog } from "@/lib/types";

export const Route = createFileRoute("/_authed/home")({
  head: () => pageHead("My boarding", "Your dogs, upcoming boarding and payments at WoofAbode."),
  component: HomePage,
});

function HomePage() {
  const { profile, isApproved, session } = useAuth();
  const { data: dogs, isLoading } = useDogs();
  const ids = dogs?.map((d) => d.id);
  const { data: days = [] } = useDayBoarding(isApproved ? ids : []);
  const { data: stays = [] } = useStays(isApproved ? ids : []);
  const { data: rates = [] } = useRates(isApproved ? ids : []);
  const { data: health = [] } = useHealth(ids);
  const { data: bills = [] } = useBills(isApproved ? session?.user.id : undefined);

  if (isLoading || !dogs) return <Loading />;
  const dogName = (id: string) => dogs.find((d) => d.id === id)?.name ?? "";
  const today = todayIST();
  const items = upcoming(days, stays, today);
  const staying = items.filter((i) => i.kind === "stay" && i.stay.status === "in_progress");
  const todayDays = items.filter((i) => i.kind === "day" && i.date === today);
  const later = items.filter((i) => !staying.includes(i) && !todayDays.includes(i)).slice(0, 12);
  const alerts = latestRecords(health).filter((r) =>
    ["overdue", "due_soon"].includes(dueState(r.next_due_date)),
  );
  const unpaid = isApproved ? bills.filter((b) => b.status !== "paid") : [];
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi{firstName ? `, ${firstName}` : ""}!</h1>
          <p className="text-muted-foreground">Here's what's coming up for your dogs.</p>
        </div>
        {isApproved && dogs.length > 0 ? <RequestBooking dogs={dogs} /> : null}
      </div>

      {!isApproved ? (
        <div className="rounded-2xl border border-warning bg-warning/15 p-4">
          <p className="font-semibold">Waiting for approval</p>
          <p className="text-sm">
            WoofAbode will approve your account shortly. Meanwhile, add your dog's profile, vet
            details and vaccination records, and fill in your emergency contacts in{" "}
            <Link to="/profile" className="underline">
              Profile
            </Link>
            .
          </p>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <section className="space-y-2">
          {alerts.map((r) => (
            <Link
              key={r.id}
              to="/dogs/$dogId"
              params={{ dogId: r.dog_id }}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3"
            >
              <AlertTriangle className="size-5 shrink-0 text-warning-foreground" />
              <div className="flex-1 text-sm">
                <span className="font-semibold">{dogName(r.dog_id)}</span>: {r.name}{" "}
                {formatDate(r.next_due_date)}
              </div>
              <Pill tone={DUE_TONE[dueState(r.next_due_date)]}>{dueLabel(r.next_due_date)}</Pill>
            </Link>
          ))}
        </section>
      ) : null}

      {unpaid.length > 0 ? (
        <section className="space-y-2">
          {unpaid.map((b) => (
            <Link
              key={b.id}
              to="/bills/$billId"
              params={{ billId: b.id }}
              className="flex items-center gap-3 rounded-2xl border border-primary bg-card px-4 py-3"
            >
              <Receipt className="size-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold">Bill for {formatMonth(b.month)}</div>
                <div className="text-sm text-muted-foreground">Tap to pay with UPI</div>
              </div>
              <div className="text-lg font-bold">{formatINR(Number(b.total) - Number(b.paid))}</div>
            </Link>
          ))}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">My dogs</h2>
        {dogs.length === 0 ? (
          <EmptyState icon={<DogIcon className="size-8" />} title="Add your first dog">
            <Button asChild className="mt-3">
              <Link to="/dogs/new">
                <Plus className="size-4" /> Add a dog
              </Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dogs.map((d) => {
              const c = boardingCounts(d.id, days, stays, today);
              return (
                <Link
                  key={d.id}
                  to="/dogs/$dogId"
                  params={{ dogId: d.id }}
                  className="rounded-2xl border bg-card p-4 hover:border-primary"
                >
                  <div className="flex items-center gap-3">
                    <DogAvatar path={d.photo_path} name={d.name} />
                    <div className="text-lg font-semibold">{d.name}</div>
                  </div>
                  {isApproved ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                      <div className="rounded-xl bg-muted p-2">
                        <div className="text-xl font-bold">{c.daysThisMonth}</div>
                        <div className="text-muted-foreground">days this month</div>
                        <div className="text-xs text-muted-foreground">
                          {c.daysAllTime} all time
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted p-2">
                        <div className="text-xl font-bold">{c.nightsThisMonth}</div>
                        <div className="text-muted-foreground">nights this month</div>
                        <div className="text-xs text-muted-foreground">
                          {c.nightsAllTime} all time
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {isApproved ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Upcoming boarding</h2>
          {staying.length + todayDays.length + later.length === 0 ? (
            <EmptyState title="Nothing booked yet">
              Bookings made by WoofAbode will show here.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {[...staying, ...todayDays, ...later].map((i) =>
                i.kind === "day" ? (
                  <div
                    key={`d-${i.dogId}-${i.date}`}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <Sun className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium">{dogName(i.dogId)}: Day boarding</div>
                      <div className="text-sm text-muted-foreground">
                        {i.date === today ? "Today" : formatDate(i.date)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i.stay.id}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <Home className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium">{dogName(i.dogId)}: Home boarding</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(stayDates(i.stay).start)} → {formatDate(stayDates(i.stay).end)}{" "}
                        · {stayNights(i.stay)} night{stayNights(i.stay) === 1 ? "" : "s"}
                        {(() => {
                          const est = estimateStayAmount(i.stay, rates);
                          return est != null ? ` · about ${formatINR(est)}` : "";
                        })()}
                      </div>
                    </div>
                    <StayStatusPill status={i.stay.status} />
                  </div>
                ),
              )}
            </div>
          )}
          <MyRequests dogIds={dogs.map((d) => d.id)} dogName={dogName} />
        </section>
      ) : null}
    </div>
  );
}

function MyRequests({ dogIds, dogName }: { dogIds: string[]; dogName: (id: string) => string }) {
  const { data = [] } = useQuery({
    queryKey: ["requests", dogIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_requests")
        .select("*")
        .in("dog_id", dogIds)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as BookingRequest[];
    },
  });
  if (data.length === 0) return null;
  const tone = { pending: "amber", approved: "green", declined: "red" } as const;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">My requests</h3>
      <div className="space-y-2">
        {data.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-2 text-sm"
          >
            <div>
              {dogName(r.dog_id)}: {r.service === "day" ? "Day boarding" : "Home boarding"}{" "}
              {formatDate(r.start_date)} → {formatDate(r.end_date)}
              {r.admin_note ? <div className="text-muted-foreground">{r.admin_note}</div> : null}
            </div>
            <Pill tone={tone[r.status]}>{r.status[0]?.toUpperCase() + r.status.slice(1)}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestBooking({ dogs }: { dogs: Dog[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dogId, setDogId] = useState(dogs[0]?.id ?? "");
  const [service, setService] = useState<"day" | "home">("home");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (end < start) return void toast.error("The end date is before the start date.");
    const { error } = await supabase
      .from("booking_requests")
      .insert({ dog_id: dogId, service, start_date: start, end_date: end, note: note || null });
    if (error) return void toast.error(error.message);
    toast.success("Request sent. WoofAbode will confirm soon.");
    queryClient.invalidateQueries({ queryKey: ["requests"] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="size-4" /> Request a booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a booking</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Dog">
            <Select value={dogId} onValueChange={setDogId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dogs.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Service">
            <Select value={service} onValueChange={(v) => setService(v as "day" | "home")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home boarding (overnight)</SelectItem>
                <SelectItem value="day">Day boarding</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input
                type="date"
                required
                min={todayIST()}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                required
                min={start || todayIST()}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Note">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Drop-off time, special care…"
            />
          </Field>
          <Button type="submit" className="w-full">
            Send request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
