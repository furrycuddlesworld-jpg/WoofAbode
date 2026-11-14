import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ writes: 0, data: {} as Record<string, unknown> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "gte", "lte", "maybeSingle", "single"]) query[method] = () => query;
  query["upsert"] = () => { mock.writes++; return query; };
  query["insert"] = () => { mock.writes++; return query; };
  query["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mock.data[table] ?? [], error: null }).then(resolve);
  return query;
} } }));
import { generateBill } from "./bills";

beforeEach(() => {
  mock.writes = 0;
  mock.data = { dogs: [{ id: "dog", name: "Miso" }], bills: null, rates: [], dog_rates: [], day_boarding: [{ dog_id: "dog", date: "2026-11-01", status: "present", imported: false }], stays: [], advances: [] };
});
it("blocks generation and writes nothing when an attended dog has no effective rate", async () => {
  expect(await generateBill("parent", "2026-11")).toEqual({ ok: false, reason: "Set rate for Miso first" });
  expect(mock.writes).toBe(0);
});