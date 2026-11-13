// Row shapes for the WoofAbode database (see supabase/migrations).

import type { BillLine, DayRecord, RateRow, Stay } from "./billing";

export type AppRole = "admin" | "client" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  whatsapp_opt_in: boolean;
  address: string | null;
  emergency1_name: string | null;
  emergency1_relation: string | null;
  emergency1_phone: string | null;
  emergency2_name: string | null;
  emergency2_relation: string | null;
  emergency2_phone: string | null;
  created_at: string;
};

export type ServiceType = "day" | "home" | "both";

export type Dog = {
  id: string;
  owner_id: string | null;
  name: string;
  photo_path: string | null;
  date_of_birth: string | null;
  breed: string | null;
  sex: "male" | "female" | null;
  neutered: boolean | null;
  weight_kg: number | null;
  location: string | null;
  food: string | null;
  medicines: string | null;
  allergies: string | null;
  behaviour_notes: string | null;
  vet_name: string | null;
  vet_clinic: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  active: boolean;
  service_type: ServiceType;
  pending_owner_email: string | null;
  pending_owner_name: string | null;
  pending_owner_phone: string | null;
  created_at: string;
};

export type HealthKind = "vaccination" | "deworming" | "health_report";

export type HealthRecord = {
  id: string;
  dog_id: string;
  kind: HealthKind;
  name: string;
  date_given: string | null;
  next_due_date: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
};

export type Rate = RateRow & { id: string };

export type DayBoarding = DayRecord & { id: string; imported: boolean; marked_at: string | null };

export type StayRow = Stay & {
  override_reason: string | null;
  notes: string | null;
  imported: boolean;
  imported_amount: number | null;
  imported_paid: boolean | null;
  created_at: string;
};

export type BillStatus = "pending" | "partly_paid" | "paid";

export type Bill = {
  id: string;
  bill_number: number;
  parent_id: string;
  month: string;
  lines: BillLine[];
  subtotal: number;
  advance_applied: number;
  total: number;
  paid: number;
  has_estimate: boolean;
  status: BillStatus;
  generated_at: string;
  sent_at: string | null;
};

export type Advance = {
  id: string;
  parent_id: string;
  amount: number;
  received_on: string;
  note: string | null;
};

export type Payment = {
  id: string;
  bill_id: string;
  amount: number;
  paid_on: string;
  method: "upi" | "cash" | "bank";
  upi_txn_id: string | null;
  status: "to_confirm" | "confirmed" | "rejected";
  note: string | null;
  created_at: string;
};

export type Settings = {
  id: number;
  business_name: string;
  business_address: string | null;
  business_phone: string | null;
  upi_id: string | null;
  upi_payee_name: string | null;
  capacity_limit: number;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type BookingRequest = {
  id: string;
  dog_id: string;
  service: "day" | "home";
  start_date: string;
  end_date: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  admin_note: string | null;
  created_at: string;
};

export type RosterRow = {
  id: string;
  dog_id: string;
  month: string;
  added_manually: boolean;
  hidden: boolean;
  created_at: string;
};
