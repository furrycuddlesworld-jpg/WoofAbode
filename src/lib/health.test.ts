import { describe, expect, it } from "vitest";

import { dueLabel, dueState, latestRecords } from "./health";
import type { HealthRecord } from "./types";

const rec = (p: Partial<HealthRecord>): HealthRecord => ({
  id: Math.random().toString(),
  dog_id: "d",
  kind: "vaccination",
  name: "Rabies",
  date_given: null,
  next_due_date: null,
  file_path: null,
  notes: null,
  created_at: "2026-01-01",
  ...p,
});

describe("health due dates", () => {
  it("classifies due dates", () => {
    expect(dueState("2026-11-01", "2026-11-02")).toBe("overdue");
    expect(dueState("2026-11-02", "2026-11-02")).toBe("due_soon");
    expect(dueState("2026-12-02", "2026-11-02")).toBe("due_soon");
    expect(dueState("2026-12-03", "2026-11-02")).toBe("ok");
    expect(dueState(null)).toBe("none");
    expect(dueLabel("2026-11-12", "2026-11-02")).toBe("Due in 10 days");
    expect(dueLabel("2026-10-31", "2026-11-02")).toBe("Overdue by 2 days");
  });

  it("keeps only the latest record of each vaccine", () => {
    const old = rec({ date_given: "2025-01-01", next_due_date: "2026-01-01" });
    const fresh = rec({ name: "rabies ", date_given: "2026-01-02", next_due_date: "2027-01-02" });
    const deworm = rec({ kind: "deworming", name: "Drontal", date_given: "2026-09-01" });
    const report = rec({ kind: "health_report", name: "Checkup" });
    expect(latestRecords([old, fresh, deworm, report])).toEqual([fresh, deworm]);
  });
});
