import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Syringe, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, Field, Pill } from "@/components/app/Common";
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
import { formatDate } from "@/lib/dates";
import { DUE_TONE, dueLabel, dueState, KIND_LABEL, latestRecords } from "@/lib/health";
import { uploadDogFile, useHealth } from "@/lib/queries";
import type { Dog, HealthKind, HealthRecord } from "@/lib/types";

async function openFile(path: string) {
  const { data, error } = await supabase.storage.from("dog-files").createSignedUrl(path, 60 * 10);
  if (error) return void toast.error(error.message);
  window.open(data.signedUrl, "_blank", "noopener");
}

export function HealthPanel({ dog }: { dog: Dog }) {
  const { data: records = [], isLoading } = useHealth([dog.id]);
  const queryClient = useQueryClient();
  const latest = new Set(latestRecords(records).map((r) => r.id));

  async function remove(r: HealthRecord) {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    const { error } = await supabase.from("health_records").delete().eq("id", r.id);
    if (error) return void toast.error(error.message);
    if (r.file_path) await supabase.storage.from("dog-files").remove([r.file_path]);
    queryClient.invalidateQueries({ queryKey: ["health"] });
  }

  const groups: HealthKind[] = ["vaccination", "deworming", "health_report"];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <AddHealthRecord dog={dog} />
      </div>
      {!isLoading && records.length === 0 ? (
        <EmptyState icon={<Syringe className="size-8" />} title="No health records yet">
          Add vaccinations, deworming and health reports with a photo or PDF.
        </EmptyState>
      ) : null}
      {groups.map((kind) => {
        const list = records.filter((r) => r.kind === kind);
        if (list.length === 0) return null;
        return (
          <section key={kind}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[kind]}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((r) => {
                const state = kind === "health_report" ? "none" : dueState(r.next_due_date);
                const isLatest = latest.has(r.id);
                return (
                  <div key={r.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {r.date_given ? `Given ${formatDate(r.date_given)}` : "Date not set"}
                          {r.next_due_date ? ` · Next ${formatDate(r.next_due_date)}` : ""}
                        </div>
                      </div>
                      {kind !== "health_report" && r.next_due_date ? (
                        isLatest ? (
                          <Pill tone={DUE_TONE[state]}>
                            {state === "ok" ? "Up to date" : dueLabel(r.next_due_date)}
                          </Pill>
                        ) : (
                          <Pill>Older record</Pill>
                        )
                      ) : null}
                    </div>
                    {r.notes ? <p className="mt-2 text-sm">{r.notes}</p> : null}
                    <div className="mt-3 flex gap-2">
                      {r.file_path ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openFile(r.file_path as string)}
                        >
                          <FileText className="size-4" /> View file
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(r)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddHealthRecord({ dog }: { dog: Dog }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<HealthKind>("vaccination");
  const [name, setName] = useState("");
  const [given, setGiven] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const file_path = file ? await uploadDogFile(dog.owner_id, dog.id, file, "health") : null;
      const { error } = await supabase.from("health_records").insert({
        dog_id: dog.id,
        kind,
        name: name.trim() || KIND_LABEL[kind],
        date_given: given || null,
        next_due_date: nextDue || null,
        notes: notes || null,
        file_path,
      });
      if (error) throw new Error(error.message);
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["health"] });
      setOpen(false);
      setName("");
      setGiven("");
      setNextDue("");
      setNotes("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a health record for {dog.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Type">
            <Select value={kind} onValueChange={(v) => setKind(v as HealthKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vaccination">Vaccination</SelectItem>
                <SelectItem value="deworming">Deworming</SelectItem>
                <SelectItem value="health_report">Health report</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Name"
            hint={kind === "vaccination" ? "e.g. Rabies, DHPPi, Kennel cough" : undefined}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={KIND_LABEL[kind]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date given">
              <Input type="date" value={given} onChange={(e) => setGiven(e.target.value)} />
            </Field>
            <Field
              label="Next due date"
              hint={kind === "health_report" ? "Optional" : "We'll send reminders"}
            >
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </Field>
          </div>
          <Field label="Report or certificate" hint="Photo or PDF">
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
