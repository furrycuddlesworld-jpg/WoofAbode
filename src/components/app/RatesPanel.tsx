import { useQueryClient } from "@tanstack/react-query";
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

/** Admin only: each dog's day, night and same-day rates, with the date each starts. */
export function RatesPanel({ dog }: { dog: Dog }) {
  const { data: rates = [] } = useRates([dog.id]);
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(todayIST());
  const [day, setDay] = useState("");
  const [night, setNight] = useState("");
  const [same, setSame] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  function startEdit(r: { effective_from: string; day_rate: number | null; night_rate: number | null; same_day_rate: number | null }) {
    const v = (n: number | null) => (n == null ? "" : String(n));
    setEditing(r.effective_from);
    setFrom(r.effective_from);
    setDay(v(r.day_rate));
    setNight(v(r.night_rate));
    setSame(v(r.same_day_rate));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditing(null);
    setFrom(todayIST());
    setDay("");
    setNight("");
    setSame("");
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
    toast.success(editing ? "Rates updated" : "Rates saved");
    setEditing(null);
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
        <h3 className="font-semibold">{editing ? `Edit rates from ${formatDate(editing)}` : "Set new rates"}</h3>
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
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Save changes" : "Save rates"}</Button>
          {editing ? <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button> : null}
        </div>
        {editing ? <p className="text-xs text-muted-foreground">Bills already created keep their amounts. New bills use the updated rates.</p> : null}
      </form>

      {rates.length === 0 ? (
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
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.effective_from)}</TableCell>
                  <TableCell>{show(r.day_rate)}</TableCell>
                  <TableCell>{show(r.night_rate)}</TableCell>
                  <TableCell>{show(r.same_day_rate)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(r)}>Edit</Button>
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
