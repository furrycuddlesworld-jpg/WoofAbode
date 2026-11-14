import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { pricingRows, type DogRate } from "./dog-rates";
import type {
  Bill,
  DayBoarding,
  Dog,
  HealthRecord,
  Profile,
  Rate,
  Settings,
  StayRow,
} from "./types";

async function rows<T>(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useDogs() {
  return useQuery({
    queryKey: ["dogs"],
    queryFn: () => rows<Dog>(supabase.from("dogs").select("*").order("name")),
  });
}

export function useDog(id: string) {
  return useQuery({
    queryKey: ["dog", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dogs").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data as Dog | null;
    },
  });
}

export function useProfiles(enabled = true) {
  return useQuery({
    queryKey: ["profiles"],
    enabled,
    queryFn: () => rows<Profile>(supabase.from("profiles").select("*").order("full_name")),
  });
}

export function useHealth(dogIds: string[] | undefined) {
  return useQuery({
    queryKey: ["health", dogIds],
    enabled: Boolean(dogIds),
    queryFn: () =>
      dogIds && dogIds.length
        ? rows<HealthRecord>(
            supabase
              .from("health_records")
              .select("*")
              .in("dog_id", dogIds)
              .order("date_given", { ascending: false }),
          )
        : Promise.resolve([]),
  });
}

export function useRates(dogIds: string[] | undefined) {
  return useQuery({
    queryKey: ["rates", dogIds],
    enabled: Boolean(dogIds),
    queryFn: () =>
      dogIds && dogIds.length
        ? Promise.all([
            rows<DogRate>(supabase.from("dog_rates").select("*").in("dog_id", dogIds)),
            rows<Rate>(supabase.from("rates").select("*").in("dog_id", dogIds)),
          ]).then(([history, legacy]) => pricingRows(history, legacy))
        : Promise.resolve([]),
  });
}

export function useDayBoarding(dogIds: string[] | undefined) {
  return useQuery({
    queryKey: ["day-boarding", dogIds],
    enabled: Boolean(dogIds),
    queryFn: () =>
      dogIds && dogIds.length
        ? rows<DayBoarding>(
            supabase.from("day_boarding").select("*").in("dog_id", dogIds).order("date"),
          )
        : Promise.resolve([]),
  });
}

export function useStays(dogIds: string[] | undefined) {
  return useQuery({
    queryKey: ["stays", dogIds],
    enabled: Boolean(dogIds),
    queryFn: () =>
      dogIds && dogIds.length
        ? rows<StayRow>(
            supabase.from("stays").select("*").in("dog_id", dogIds).order("planned_start"),
          )
        : Promise.resolve([]),
  });
}

export function useBills(parentId?: string) {
  return useQuery({
    queryKey: ["bills", parentId ?? "all"],
    queryFn: () => {
      let q = supabase.from("bills").select("*").order("month", { ascending: false });
      if (parentId) q = q.eq("parent_id", parentId);
      return rows<Bill>(q);
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw new Error(error.message);
      return data as Settings | null;
    },
  });
}

/** Upload a file to the private dog-files bucket under the owner's folder. Returns the storage path. */
export async function uploadDogFile(
  ownerId: string | null,
  dogId: string,
  file: File,
  sub = "",
): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ownerId ?? "unassigned"}/${dogId}/${sub ? `${sub}/` : ""}${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("dog-files").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
