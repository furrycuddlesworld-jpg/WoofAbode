import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("parses headers, quotes and blank lines", () => {
    const text = '\uFEFFDog_Name,Note\r\nMiso,"Loves, treats"\r\n\r\n"Ezio ""Boy""",\n';
    expect(parseCsv(text)).toEqual([
      { dog_name: "Miso", note: "Loves, treats" },
      { dog_name: 'Ezio "Boy"', note: "" },
    ]);
  });

  it("round-trips", () => {
    const rows = [
      ["a", "b,c"],
      ['d"e', "f"],
    ];
    expect(parseCsv(toCsv([["x", "y"], ...rows])).map((r) => [r["x"], r["y"]])).toEqual(rows);
  });
});
