import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import { parseAttendance, parseDogs, parseStays, unmatchedNames } from "./importer";

describe("importer", () => {
  it("reads the dogs file produced from the spreadsheet", () => {
    const csv =
      "dog_name,parent_name,parent_email,parent_phone,breed,sex,date_of_birth,day_rate_inr,home_rate_inr,same_day_rate_inr\n" +
      "Churro,Sangeeta,Sangeeta@X.com,999,Indie,M,2022-03-01,650,1000,750\nAstro,,,,,,,,1700,750\n";
    const { rows, errors } = parseDogs(parseCsv(csv));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      dog_name: "Churro",
      parent_email: "sangeeta@x.com",
      sex: "male",
      day_rate: 650,
    });
    expect(rows[1]).toMatchObject({ dog_name: "Astro", day_rate: null, home_rate: 1700 });
  });

  it("reports bad lines", () => {
    expect(
      parseAttendance(
        parseCsv(
          "date,dog_name,status\n2025-09-01,Churro,present\n01/09/2025,Ezio,present\n2025-09-02,Miso,maybe\n",
        ),
      ).errors,
    ).toHaveLength(2);
    expect(
      parseStays(
        parseCsv(
          "dog_name,check_in,check_out,amount_inr,payment_status\nMaui,2026-04-21,2026-04-15,7200,paid\n",
        ),
      ).errors[0],
    ).toMatch(/before/);
  });

  it("reads stays", () => {
    const { rows } = parseStays(
      parseCsv(
        "dog_name,check_in,check_out,nights,rate_inr,amount_inr,payment_status,sheet_month\nMaui,2026-04-15,2026-04-21,6,1200,7200,paid,April\nAstro,2026-10-31,2026-11-01,1,1700,1700,pending,October\n",
      ),
    );
    expect(rows).toEqual([
      {
        dog_name: "Maui",
        check_in: "2026-04-15",
        check_out: "2026-04-21",
        amount: 7200,
        paid: true,
      },
      {
        dog_name: "Astro",
        check_in: "2026-10-31",
        check_out: "2026-11-01",
        amount: 1700,
        paid: false,
      },
    ]);
  });

  it("finds unknown dog names, ignoring case", () => {
    expect(unmatchedNames(["Miso", "miso", "Bruno"], ["MISO"])).toEqual(["Bruno"]);
  });
});
