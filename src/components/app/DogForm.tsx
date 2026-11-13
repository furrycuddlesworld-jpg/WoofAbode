import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { Button } from "@/components/ui/button";
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
import { uploadDogFile, useProfiles } from "@/lib/queries";
import type { Dog } from "@/lib/types";

type FormState = Record<string, string>;

const TEXT_FIELDS = [
  "name",
  "date_of_birth",
  "breed",
  "sex",
  "neutered",
  "weight_kg",
  "location",
  "food",
  "medicines",
  "allergies",
  "behaviour_notes",
  "vet_name",
  "vet_clinic",
  "vet_phone",
  "vet_address",
  "owner_id",
  "service_type",
] as const;

function toForm(dog: Partial<Dog> | null): FormState {
  const f: FormState = {};
  for (const k of TEXT_FIELDS) {
    const v = dog?.[k as keyof Dog];
    f[k] = v == null ? "" : String(v);
  }
  return f;
}

export function DogForm({ dog, onSaved }: { dog: Dog | null; onSaved: (dog: Dog) => void }) {
  const { session, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles(isAdmin);
  const [form, setForm] = useState<FormState>(() =>
    toForm(dog ?? { owner_id: session?.user.id ?? null, service_type: "both" }),
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const get = (k: string) => form[k] ?? "";

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ownerId = isAdmin ? get("owner_id") || null : (session?.user.id ?? null);
    const row = {
      name: get("name").trim(),
      date_of_birth: get("date_of_birth") || null,
      breed: get("breed") || null,
      sex: get("sex") || null,
      neutered: get("neutered") === "" ? null : get("neutered") === "true",
      weight_kg: get("weight_kg") ? Number(get("weight_kg")) : null,
      location: get("location") || null,
      food: get("food") || null,
      medicines: get("medicines") || null,
      allergies: get("allergies") || null,
      behaviour_notes: get("behaviour_notes") || null,
      vet_name: get("vet_name") || null,
      vet_clinic: get("vet_clinic") || null,
      vet_phone: get("vet_phone") || null,
      vet_address: get("vet_address") || null,
      owner_id: ownerId,
      service_type: (get("service_type") || "both") as Dog["service_type"],
    };
    try {
      const res = dog
        ? await supabase.from("dogs").update(row).eq("id", dog.id).select("*").single()
        : await supabase.from("dogs").insert(row).select("*").single();
      if (res.error) throw new Error(res.error.message);
      let saved = res.data as Dog;
      if (photo) {
        const path = await uploadDogFile(saved.owner_id, saved.id, photo, "photo");
        const up = await supabase
          .from("dogs")
          .update({ photo_path: path })
          .eq("id", saved.id)
          .select("*")
          .single();
        if (up.error) throw new Error(up.error.message);
        saved = up.data as Dog;
      }
      await queryClient.invalidateQueries({ queryKey: ["dogs"] });
      await queryClient.invalidateQueries({ queryKey: ["dog", saved.id] });
      toast.success(`${saved.name} saved`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">About the dog</h2>
        <div className="flex items-center gap-4">
          <DogAvatar path={dog?.photo_path ?? null} name={get("name")} className="size-20" />
          <Field label="Photo" className="flex-1">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input required value={get("name")} onChange={set("name")} />
          </Field>
          <Field label="Breed">
            <Input value={get("breed")} onChange={set("breed")} placeholder="e.g. Indie, Beagle" />
          </Field>
          <Field label="Date of birth" hint="Age is worked out from this">
            <Input type="date" value={get("date_of_birth")} onChange={set("date_of_birth")} />
          </Field>
          <Field label="Weight (kg)">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={get("weight_kg")}
              onChange={set("weight_kg")}
            />
          </Field>
          <Field label="Sex">
            <Select value={get("sex")} onValueChange={(v) => setForm((f) => ({ ...f, sex: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Neutered / spayed">
            <Select
              value={get("neutered")}
              onValueChange={(v) => setForm((f) => ({ ...f, neutered: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usually comes for">
            <Select
              value={get("service_type") || "both"}
              onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day boarding</SelectItem>
                <SelectItem value="home">Home boarding</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location / area" className="sm:col-span-2">
            <Input
              value={get("location")}
              onChange={set("location")}
              placeholder="Where the dog lives"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Care notes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Food" hint="Brand, amount and times">
            <Textarea rows={2} value={get("food")} onChange={set("food")} />
          </Field>
          <Field label="Medicines">
            <Textarea rows={2} value={get("medicines")} onChange={set("medicines")} />
          </Field>
          <Field label="Allergies">
            <Textarea rows={2} value={get("allergies")} onChange={set("allergies")} />
          </Field>
          <Field label="Behaviour" hint="Good with other dogs? Afraid of anything?">
            <Textarea rows={2} value={get("behaviour_notes")} onChange={set("behaviour_notes")} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Vet</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vet's name">
            <Input value={get("vet_name")} onChange={set("vet_name")} />
          </Field>
          <Field label="Clinic">
            <Input value={get("vet_clinic")} onChange={set("vet_clinic")} />
          </Field>
          <Field label="Vet's phone">
            <Input type="tel" value={get("vet_phone")} onChange={set("vet_phone")} />
          </Field>
          <Field label="Clinic address">
            <Input value={get("vet_address")} onChange={set("vet_address")} />
          </Field>
        </div>
      </section>

      {isAdmin ? (
        <section className="space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Pet parent</h2>
          <Select
            value={get("owner_id")}
            onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose the parent" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email} ({p.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
