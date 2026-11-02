// Turning the spreadsheet export (three CSV files) into database rows.

export type DogCsvRow = {
  dog_name: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  breed: string;
  sex: string;
  date_of_birth: string;
  day_rate: number | null;
  home_rate: number | null;
  same_day_rate: number | null;
};

export type AttendanceCsvRow = { date: string; dog_name: string; status: "present" | "absent" };

export type StayCsvRow = {
  dog_name: string;
  check_in: string;
  check_out: string;
  amount: number;
  paid: boolean;
};

export type ParseResult<T> = { rows: T[]; errors: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: string | undefined) =>
  v && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
const key = (name: string) => name.trim().toLowerCase();

export function parseDogs(records: Record<string, string>[]): ParseResult<DogCsvRow> {
  const errors: string[] = [];
  const rows: DogCsvRow[] = [];
  records.forEach((r, i) => {
    const name = (r["dog_name"] ?? "").trim();
    if (!name) return void errors.push(`dogs.csv line ${i + 2}: missing dog_name`);
    const email = (r["parent_email"] ?? "").trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      errors.push(`dogs.csv line ${i + 2}: "${email}" is not an email`);
    const dob = (r["date_of_birth"] ?? "").trim();
    if (dob && !DATE.test(dob))
      errors.push(`dogs.csv line ${i + 2}: date_of_birth must be YYYY-MM-DD`);
    const sex = (r["sex"] ?? "").trim().toLowerCase();
    rows.push({
      dog_name: name,
      parent_name: (r["parent_name"] ?? "").trim(),
      parent_email: email,
      parent_phone: (r["parent_phone"] ?? "").trim(),
      breed: (r["breed"] ?? "").trim(),
      sex: sex.startsWith("m") ? "male" : sex.startsWith("f") ? "female" : "",
      date_of_birth: DATE.test(dob) ? dob : "",
      day_rate: num(r["day_rate_inr"]),
      home_rate: num(r["home_rate_inr"]),
      same_day_rate: num(r["same_day_rate_inr"]),
    });
  });
  return { rows, errors };
}

export function parseAttendance(records: Record<string, string>[]): ParseResult<AttendanceCsvRow> {
  const errors: string[] = [];
  const rows: AttendanceCsvRow[] = [];
  records.forEach((r, i) => {
    const date = (r["date"] ?? "").trim();
    const status = (r["status"] ?? "").trim().toLowerCase();
    if (!DATE.test(date)) return void errors.push(`attendance line ${i + 2}: bad date "${date}"`);
    if (status !== "present" && status !== "absent")
      return void errors.push(`attendance line ${i + 2}: status must be present or absent`);
    rows.push({ date, dog_name: (r["dog_name"] ?? "").trim(), status });
  });
  return { rows, errors };
}

export function parseStays(records: Record<string, string>[]): ParseResult<StayCsvRow> {
  const errors: string[] = [];
  const rows: StayCsvRow[] = [];
  records.forEach((r, i) => {
    const check_in = (r["check_in"] ?? "").trim();
    const check_out = (r["check_out"] ?? "").trim();
    if (!DATE.test(check_in) || !DATE.test(check_out))
      return void errors.push(`stays line ${i + 2}: dates must be YYYY-MM-DD`);
    if (check_out < check_in)
      return void errors.push(`stays line ${i + 2}: check_out is before check_in`);
    rows.push({
      dog_name: (r["dog_name"] ?? "").trim(),
      check_in,
      check_out,
      amount: num(r["amount_inr"]) ?? 0,
      paid: (r["payment_status"] ?? "").trim().toLowerCase() === "paid",
    });
  });
  return { rows, errors };
}

/** Names used in attendance/stays that are neither in the database nor in dogs.csv. */
export function unmatchedNames(names: string[], known: string[]): string[] {
  const k = new Set(known.map(key));
  return [...new Set(names.filter((n) => !k.has(key(n))))].sort();
}

export { key as nameKey };
