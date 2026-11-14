import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Run with a freshly registered temporary user's session file; never logs credentials.
it.skipIf(!process.env['CLIENT_ACCESS_SESSION_FILE'])("registration grants client access but not attendance or price writes", async () => {
  const file = process.env['CLIENT_ACCESS_SESSION_FILE'];
  if (!file) throw new Error("A new client's session is required");
  const { session } = JSON.parse(readFileSync(file, "utf8"));
  const request = (table: string, method = "GET", body?: unknown) => fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/${table}`, {
    method, headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? "", Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const roles = await request(`user_roles?user_id=eq.${session.user.id}&select=role`);
  expect(roles.ok).toBe(true);
  expect(await roles.json()).toEqual([{ role: "client" }]);
  const created = await request("dogs", "POST", { name: "Temporary access verification", owner_id: session.user.id });
  expect(created.ok).toBe(true);
  const [dog] = await created.json();
  expect(dog.day_boarding_rate).toBeNull();
  const attendance = await request("day_boarding", "POST", { dog_id: dog.id, date: "2026-11-14", status: "present" });
  expect(attendance.status).toBe(403);
  const rate = await request("dog_rates", "POST", { dog_id: dog.id, service: "day", rate: 1, effective_from: "2026-11-14" });
  expect(rate.status).toBe(403);
  const dogRate = await request(`dogs?id=eq.${dog.id}`, "PATCH", { day_boarding_rate: 1 });
  expect(dogRate.ok).toBe(false);
});