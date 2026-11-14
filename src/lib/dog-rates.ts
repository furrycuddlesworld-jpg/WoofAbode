import type { RateRow } from "./billing";

export type DogRate = { id: string; dog_id: string; service: "day" | "home"; rate: number; effective_from: string; created_at: string };

/** History is append-only; the last recorded change wins when dates coincide. */
export function pricingRows(history: DogRate[], legacy: (RateRow & { id: string })[]): (RateRow & { id: string })[] {
  const sorted = [...history].sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const seen = new Set<string>();
  const rows: (RateRow & { id: string })[] = [];
  for (const r of sorted) {
    const key = `${r.dog_id}|${r.service}|${r.effective_from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: r.id, dog_id: r.dog_id, effective_from: r.effective_from, day_rate: r.service === "day" ? Number(r.rate) : null, night_rate: r.service === "home" ? Number(r.rate) : null, same_day_rate: null });
  }
  return [...rows, ...legacy.map(r => ({ ...r, day_rate: null, night_rate: null }))];
}
export type GroupedRate = {
  effective_from: string;
  day: DogRate | null; home: DogRate | null; dayIds: string[]; homeIds: string[];
  legacy: (RateRow & { id: string }) | null;
};

/** One display row per start date: newest day + home rate and the legacy same-day rate side by side. */
export function groupRateRows(history: DogRate[], legacy: (RateRow & { id: string })[]): GroupedRate[] {
  const map = new Map<string, GroupedRate>();
  const get = (d: string) => map.get(d) ?? (map.set(d, { effective_from: d, day: null, home: null, dayIds: [], homeIds: [], legacy: null }), map.get(d)!);
  const sorted = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  for (const r of sorted) {
    const g = get(r.effective_from);
    if (r.service === "day") { g.dayIds.push(r.id); g.day ??= r; } else { g.homeIds.push(r.id); g.home ??= r; }
  }
  for (const r of legacy) { const g = get(r.effective_from); if (r.same_day_rate != null || !g.legacy) g.legacy = r; }
  return [...map.values()].filter(g => g.day || g.home || g.legacy?.same_day_rate != null || g.legacy).sort((a, b) => b.effective_from.localeCompare(a.effective_from));
}
