import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, Field } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatINR, todayIST } from "@/lib/dates";
import { useRates } from "@/lib/queries";
import { rateOn } from "@/lib/billing";
import type { Dog } from "@/lib/types";
import { groupRateRows, type DogRate, type GroupedRate } from "@/lib/dog-rates";
import type { RateRow } from "@/lib/billing";

/** Admin only: each dog's day, night and same-day rates, with the date each starts. */
export function RatesPanel({ dog }: { dog: Dog }) {
  const { data: rates = [] } = useRates([dog.id]);
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(todayIST());
  const [day, setDay] = useState("");
  const [night, setNight] = useState("");
  const [same, setSame] = useState("");
  const { data: raw } = useQuery({
    queryKey: ["rates", "raw", dog.id],
    queryFn: async () => {
      const [h, l] = await Promise.all([
        supabase.from("dog_rates").select("*").eq("dog_id", dog.id),
        supabase.from("rates").select("*").eq("dog_id", dog.id),
      ]);
      if (h.error || l.error) throw new Error((h.error ?? l.error)!.message);
      return { history: (h.data ?? []) as DogRate[], legacy: (l.data ?? []) as (RateRow & { id: string })[] };
    },
  });
  const grouped = raw ? groupRateRows(raw.history, raw.legacy) : [];
  const [edit, setEdit] = useState<{ key: string; from: string; day: string; night: string; same: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(g: GroupedRate) {
    const v = (n: number | null | undefined) => (n == null ? "" : String(n));
    setEdit({ key: g.effective_from, from: g.effective_from, day: v(g.day?.rate), night: v(g.home?.rate), same: v(g.legacy?.same_day_rate) });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["rates"] });
    queryClient.invalidateQueries({ queryKey: ["dogs"] });
    queryClient.invalidateQueries({ queryKey: ["dog", dog.id] });
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
  }

  async function saveEdit(g: GroupedRate) {
    if (!edit || !edit.from) return;
    if (edit.from !== g.effective_from && grouped.some((x) => x.effective_from === edit.from)) {
      return void toast.error("An entry already exists for this date");
    }
    setBusy(true);
    try {
      for (const [service, value, ids] of [["day", edit.day, g.dayIds], ["home", edit.night, g.homeIds]] as const) {
        const [keep, ...older] = ids;
        if (older.length) { const { error } = await supabase.from("dog_rates").delete().in("id", older); if (error) throw error; }
        if (value === "") {
          if (keep) { const { error } = await supabase.from("dog_rates").delete().eq("id", keep); if (error) throw error; }
        } else if (keep) {
          const { error } = await supabase.from("dog_rates").update({ rate: Number(value), effective_from: edit.from }).eq("id", keep); if (error) throw error;
        } else {
          const { error } = await supabase.from("dog_rates").insert({ dog_id: dog.id, service, rate: Number(value), effective_from: edit.from }); if (error) throw error;
        }
      }
      const same = edit.same === "" ? null : Number(edit.same);
      if (g.legacy) {
        // Day/night live in dog_rates; clearing them here stops the mirror trigger re-adding copies.
        const { error } = await supabase.from("rates").update({ effective_from: edit.from, same_day_rate: same, day_rate: null, night_rate: null }).eq("id", g.legacy.id); if (error) throw error;
      } else if (same != null) {
        const { error } = await supabase.from("rates").insert({ dog_id: dog.id, effective_from: edit.from, same_day_rate: same }); if (error) throw error;
      }
      toast.success("Rates updated");
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update rates");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(g: GroupedRate) {
    if (!window.confirm(`Delete the rates starting ${formatDate(g.effective_from)}? Bills already created keep their amounts.`)) return;
    setBusy(true);
    try {
      const ids = [...g.dayIds, ...g.homeIds];
      if (ids.length) { const { error } = await supabase.from("dog_rates").delete().in("id", ids); if (error) throw error; }
      if (g.legacy) { const { error } = await supabase.from("rates").delete().eq("id", g.legacy.id); if (error) throw error; }
      toast.success("Rates deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete rates");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const num = (v: string) => (v === "" ? null : Number(v));
    const changes = [
      ...(day === "" ? [] : [{ dog_id: dog.id, effective_from: from, service: "day", rate: Number(day) }]),
      ...(night === "" ? [] : [{ dog_id: dog.id, effective_from: from, service: "home", rate: Number(night) }]),
    ];
    if (changes.length) {
      const { error } = await supabase.from("dog_rates").insert(changes);
      if (error) return void toast.error(error.message);
    }
    if (same !== "") {
      const { error } = await supabase.from("rates").upsert({ dog_id: dog.id, effective_from: from, same_day_rate: num(same) }, { onConflict: "dog_id,effective_from" });
      if (error) return void toast.error(error.message);
    }
    toast.success("Rates saved");
    setDay("");
    setNight("");
    setSame("");
    queryClient.invalidateQueries({ queryKey: ["rates"] });
    queryClient.invalidateQueries({ queryKey: ["dogs"] });
    queryClient.invalidateQueries({ queryKey: ["dog", dog.id] });
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
  }

  const show = (v: number | null) => (v == null ? "—" : formatINR(Number(v)));

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-4">
        <h3 className="font-semibold">Set new rates</h3>
        <p className="text-sm text-muted-foreground">
          Leave a box empty to keep the earlier rate for that service. Old bills keep the rates that
          applied then.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Starts from">
            <Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Day boarding / day">
            <Input
              type="number"
              min="0"
              placeholder={rateOn(rates, dog.id, todayIST(), "day_rate")?.toString() ?? "Not set"}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label="Home boarding / night">
            <Input
              type="number"
              min="0"
              placeholder={rateOn(rates, dog.id, todayIST(), "night_rate")?.toString() ?? "Not set"}
              value={night}
              onChange={(e) => setNight(e.target.value)}
            />
          </Field>
          <Field label="Same-day stay">
            <Input
              type="number"
              min="0"
              placeholder={rateOn(rates, dog.id, todayIST(), "same_day_rate")?.toString() ?? "Not set"}
              value={same}
              onChange={(e) => setSame(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit">Save rates</Button>
      </form>

      {grouped.length === 0 ? (
        <EmptyState title="No rates yet">
          Bills can't be calculated for {dog.name} until rates are set.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Night</TableHead>
                <TableHead>Same day</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g) => edit?.key === g.effective_from ? (
                <TableRow key={g.effective_from}>
                  <TableCell><Input aria-label="Edit start date" type="date" className="w-40" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label="Edit day rate" type="number" min="0" className="w-24" value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label="Edit night rate" type="number" min="0" className="w-24" value={edit.night} onChange={(e) => setEdit({ ...edit, night: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label="Edit same-day rate" type="number" min="0" className="w-24" value={edit.same} onChange={(e) => setEdit({ ...edit, same: e.target.value })} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" disabled={busy} onClick={() => saveEdit(g)}>Save</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={g.effective_from}>
                  <TableCell>{formatDate(g.effective_from)}</TableCell>
                  <TableCell>{show(g.day?.rate ?? null)}</TableCell>
                  <TableCell>{show(g.home?.rate ?? null)}</TableCell>
                  <TableCell>{show(g.legacy?.same_day_rate ?? null)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(g)}>Edit</Button>{" "}
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => removeEntry(g)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
