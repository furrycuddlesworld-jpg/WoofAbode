import { describe, expect, it } from "vitest";
import { dogOwnership } from "./dog-owner";

describe("dog save ownership", () => {
  it("rejects a missing identity instead of inserting an unowned customer dog", () => {
    expect(() => dogOwnership(undefined, false, "", false)).toThrow("sign-in has expired");
  });
  it("uses the authenticated customer rather than the form's selected owner", () => {
    expect(dogOwnership("current-customer", false, "stale-customer", false)).toEqual({ owner_id: "current-customer" });
  });
  it("does not reassign ownership when a customer edits a dog", () => {
    expect(dogOwnership("current-customer", false, "other-owner", true)).toEqual({});
  });
  it("preserves an admin's selected parent", () => {
    expect(dogOwnership("admin", true, "chosen-parent", false)).toEqual({ owner_id: "chosen-parent" });
  });
});