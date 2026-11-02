import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, PageHeader } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { parseCsv } from "@/lib/csv";
import {
  nameKey,
  parseAttendance,
  parseDogs,
  parseStays,
  unmatchedNames,
  type AttendanceCsvRow,
  type DogCsvRow,
  type StayCsvRow,
} from "@/lib/importer";
import type { Dog, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/import")({
  component: ImportPage,
});

type Parsed = {
  dogs: DogCsvRow[];
  attendance: AttendanceCsvRow[];
  stays: StayCsvRow[];
  errors: string[];
  unmatched: string[];
};

// Rates from the spreadsheet apply from the start of its history.
const HISTORY_START = "2025-09-01";

async function readFile(file: File | null): Promise<Record<string, string>[]> {
  return file ? parseCsv(await file.text()) : [];
}

function ImportPage() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<{
    dogs: File | null;
    attendance: File | null;
    stays: File | null;
  }>({
    dogs: null,
    attendance: null,
    stays: null,
  });
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function preview() {
    const d = parseDogs(await readFile(files.dogs));
    const a = parseAttendance(await readFile(files.attendance));
    const s = parseStays(await readFile(files.stays));
    const { data: existing } = await supabase.from("dogs").select("name");
    const known = [
      ...d.rows.map((r) => r.dog_name),
      ...((existing ?? []) as { name: string }[]).map((r) => r.name),
    ];
    setParsed({
      dogs: d.rows,
      attendance: a.rows,
      stays: s.rows,
      errors: [...d.errors, ...a.errors, ...s.errors],
      unmatched: unmatchedNames(
        [...a.rows, ...s.rows].map((r) => r.dog_name),
        known,
      ),
    });
    setLog([]);
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const out: string[] = [];
    try {
      const [{ data: dogRows }, { data: profileRows }] = await Promise.all([
        supabase.from("dogs").select("*"),
        supabase.from("profiles").select("*"),
      ]);
      const dogs = new Map(((dogRows ?? []) as Dog[]).map((d) => [nameKey(d.name), d]));
      const profiles = new Map(
        ((profileRows ?? []) as Profile[]).map((p) => [p.email.toLowerCase(), p]),
      );

      // 1. Dogs, parents and rates
      let created = 0;
      let linked = 0;
      for (const r of parsed.dogs) {
        const parent = r.parent_email ? profiles.get(r.parent_email) : undefined;
        let dog = dogs.get(nameKey(r.dog_name));
        if (!dog) {
          const { data, error } = await supabase
            .from("dogs")
            .insert({
              name: r.dog_name,
              breed: r.breed || null,
              sex: r.sex || null,
              date_of_birth: r.date_of_birth || null,
              owner_id: parent?.id ?? null,
              pending_owner_email: parent ? null : r.parent_email || null,
              pending_owner_name: r.parent_name || null,
              pending_owner_phone: r.parent_phone || null,
            })
            .select("*")
            .single();
          if (error) throw new Error(`${r.dog_name}: ${error.message}`);
          dog = data as Dog;
          dogs.set(nameKey(dog.name), dog);
          created += 1;
        } else if (!dog.owner_id && r.parent_email) {
          await supabase
            .from("dogs")
            .update({
              owner_id: parent?.id ?? null,
              pending_owner_email: parent ? null : r.parent_email,
              pending_owner_name: r.parent_name || null,
              pending_owner_phone: r.parent_phone || null,
            })
            .eq("id", dog.id);
        }
        if (parent) {
          linked += 1;
          await supabase
            .from("user_roles")
            .upsert({ user_id: parent.id, role: "client" }, { onConflict: "user_id,role" });
          await supabase.from("user_roles").delete().eq("user_id", parent.id).eq("role", "user");
        }
        if (r.day_rate != null || r.home_rate != null || r.same_day_rate != null) {
          const { error } = await supabase.from("rates").upsert(
            {
              dog_id: dog.id,
              effective_from: HISTORY_START,
              day_rate: r.day_rate,
              night_rate: r.home_rate,
              same_day_rate: r.same_day_rate,
            },
            { onConflict: "dog_id,effective_from" },
          );
          if (error) throw new Error(`Rates for ${r.dog_name}: ${error.message}`);
        }
      }
      out.push(
        `Dogs: ${created} added, ${parsed.dogs.length - created} already there, ${linked} linked to parents with accounts.`,
      );

      // 2. Day-boarding attendance (existing days are kept)
      const att = parsed.attendance
        .map((r) => ({ dog: dogs.get(nameKey(r.dog_name)), r }))
        .filter((x) => x.dog)
        .map(({ dog, r }) => ({
          dog_id: (dog as Dog).id,
          date: r.date,
          status: r.status,
          imported: true,
        }));
      for (let i = 0; i < att.length; i += 500) {
        const { error } = await supabase
          .from("day_boarding")
          .upsert(att.slice(i, i + 500), { onConflict: "dog_id,date", ignoreDuplicates: true });
        if (error) throw new Error(`Attendance: ${error.message}`);
      }
      out.push(`Day boarding: ${att.length} days imported.`);

      // 3. Home-boarding stays (skips ones already imported)
      const { data: oldStays } = await supabase
        .from("stays")
        .select("dog_id, planned_start, planned_end")
        .eq("imported", true);
      const seen = new Set(
        ((oldStays ?? []) as { dog_id: string; planned_start: string; planned_end: string }[]).map(
          (s) => `${s.dog_id}|${s.planned_start}|${s.planned_end}`,
        ),
      );
      const newStays = parsed.stays
        .map((r) => ({ dog: dogs.get(nameKey(r.dog_name)), r }))
        .filter((x) => x.dog && !seen.has(`${(x.dog as Dog).id}|${x.r.check_in}|${x.r.check_out}`))
        .map(({ dog, r }) => ({
          dog_id: (dog as Dog).id,
          planned_start: r.check_in,
          planned_end: r.check_out,
          status: "completed" as const,
          imported: true,
          imported_amount: r.amount,
          imported_paid: r.paid,
        }));
      if (newStays.length) {
        const { error } = await supabase.from("stays").insert(newStays);
        if (error) throw new Error(`Stays: ${error.message}`);
      }
      out.push(
        `Home boarding: ${newStays.length} stays imported (${newStays.filter((s) => !s.imported_paid).length} unpaid, shown under Bills).`,
      );
      out.push("Done. No bills or messages were created from the history.");
      toast.success("Import finished");
      queryClient.invalidateQueries();
    } catch (err) {
      out.push(`Stopped: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("Import stopped. See the log.");
    } finally {
      setLog(out);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Import from the spreadsheet"
        subtitle="Load your history so parents see their days boarded from day one. Safe to run again: nothing is added twice."
      />
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <Field
          label="dogs.csv"
          hint="Dog names, parents' names, emails and phones, and rates. Parents who sign up later with that email get their dog automatically."
        >
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFiles((f) => ({ ...f, dogs: e.target.files?.[0] ?? null }))}
          />
        </Field>
        <Field label="day_boarding_attendance.csv">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFiles((f) => ({ ...f, attendance: e.target.files?.[0] ?? null }))}
          />
        </Field>
        <Field label="home_boarding_stays.csv">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFiles((f) => ({ ...f, stays: e.target.files?.[0] ?? null }))}
          />
        </Field>
        <Button onClick={preview} disabled={!files.dogs && !files.attendance && !files.stays}>
          Check files
        </Button>
      </div>

      {parsed ? (
        <div className="mt-5 space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Ready to import</h2>
          <ul className="list-inside list-disc text-sm">
            <li>
              {parsed.dogs.length} dogs ({parsed.dogs.filter((d) => d.parent_email).length} with a
              parent email)
            </li>
            <li>{parsed.attendance.length} day-boarding days</li>
            <li>{parsed.stays.length} home-boarding stays</li>
          </ul>
          {parsed.unmatched.length ? (
            <p className="rounded-xl bg-warning/20 p-3 text-sm">
              These names aren't in dogs.csv or the app, so their rows will be skipped:{" "}
              {parsed.unmatched.join(", ")}
            </p>
          ) : null}
          {parsed.errors.length ? (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {parsed.errors.slice(0, 20).map((e) => (
                <div key={e}>{e}</div>
              ))}
              {parsed.errors.length > 20 ? <div>…and {parsed.errors.length - 20} more</div> : null}
            </div>
          ) : null}
          <Button onClick={run} disabled={busy}>
            <Upload className="size-4" /> {busy ? "Importing…" : "Import now"}
          </Button>
        </div>
      ) : null}

      {log.length ? (
        <div className="mt-5 space-y-1 rounded-2xl bg-muted p-4 text-sm">
          {log.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      ) : null}
    </>
  );
}
