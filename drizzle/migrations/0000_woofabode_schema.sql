-- WoofAbode database: accounts, dogs, health records, rates, bookings, attendance, bills and payments.
-- Every table has row-level security: pet parents only ever see their own data, admins see everything.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'client', 'user');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  whatsapp text,
  whatsapp_opt_in boolean not null default false,
  address text,
  emergency1_name text,
  emergency1_relation text,
  emergency1_phone text,
  emergency2_name text,
  emergency2_relation text,
  emergency2_phone text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin') $$;

-- Approved parents (clients) and admins can see bookings and bills.
create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'client') $$;

-- ---------------------------------------------------------------------------
-- Dogs and health
-- ---------------------------------------------------------------------------
create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  photo_path text,
  date_of_birth date,
  breed text,
  sex text check (sex in ('male', 'female')),
  neutered boolean,
  weight_kg numeric(5, 1),
  location text,
  food text,
  medicines text,
  allergies text,
  behaviour_notes text,
  vet_name text,
  vet_clinic text,
  vet_phone text,
  vet_address text,
  active boolean not null default true,
  -- For dogs imported before the parent has an account: linked automatically when they sign up.
  pending_owner_email text,
  pending_owner_name text,
  pending_owner_phone text,
  created_at timestamptz not null default now()
);
create index dogs_owner_idx on public.dogs (owner_id);
create index dogs_pending_email_idx on public.dogs (lower(pending_owner_email));

-- New sign-ups get a profile and the "user" role (waiting for approval).
-- The very first account ever created becomes the admin, so Avi should sign up first.
-- Someone whose email matches an imported dog is an existing customer: they get the dog and the
-- "client" role straight away.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  first_user boolean;
  claimed int;
  imported_name text;
  imported_phone text;
begin
  select not exists (select 1 from public.user_roles) into first_user;

  select pending_owner_name, pending_owner_phone into imported_name, imported_phone
    from public.dogs
   where owner_id is null and lower(pending_owner_email) = lower(new.email)
   limit 1;

  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), imported_name, ''),
    imported_phone
  );

  update public.dogs
     set owner_id = new.id, pending_owner_email = null
   where owner_id is null and lower(pending_owner_email) = lower(new.email);
  get diagnostics claimed = row_count;

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case when first_user then 'admin'::public.app_role
         when claimed > 0 then 'client'::public.app_role
         else 'user'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.owns_dog(_dog_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.dogs where id = _dog_id and owner_id = auth.uid()) $$;

create type public.health_kind as enum ('vaccination', 'deworming', 'health_report');

create table public.health_records (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  kind public.health_kind not null,
  name text not null,
  date_given date,
  next_due_date date,
  file_path text,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index health_records_dog_idx on public.health_records (dog_id);
create index health_records_due_idx on public.health_records (next_due_date);

-- ---------------------------------------------------------------------------
-- Rates, bookings and attendance
-- ---------------------------------------------------------------------------
create table public.rates (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  effective_from date not null,
  day_rate numeric(10, 2),
  night_rate numeric(10, 2),
  same_day_rate numeric(10, 2),
  created_at timestamptz not null default now(),
  unique (dog_id, effective_from)
);

create type public.day_status as enum ('scheduled', 'present', 'absent');

-- One row per dog per day of day boarding: scheduled ahead, then marked present or absent.
create table public.day_boarding (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  date date not null,
  status public.day_status not null default 'scheduled',
  imported boolean not null default false,
  marked_at timestamptz,
  unique (dog_id, date)
);
create index day_boarding_date_idx on public.day_boarding (date);

create type public.stay_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Home (full) boarding: tentative dates first, then actual start/end when the admin starts and ends it.
create table public.stays (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  planned_start date not null,
  planned_end date not null,
  actual_start timestamptz,
  actual_end timestamptz,
  status public.stay_status not null default 'scheduled',
  night_rate_override numeric(10, 2),
  override_reason text,
  notes text,
  imported boolean not null default false,
  imported_amount numeric(10, 2),
  imported_paid boolean,
  created_at timestamptz not null default now(),
  check (planned_end >= planned_start)
);
create index stays_dog_idx on public.stays (dog_id);
create index stays_dates_idx on public.stays (planned_start, planned_end);

-- ---------------------------------------------------------------------------
-- Bills and payments
-- ---------------------------------------------------------------------------
create type public.bill_status as enum ('pending', 'partly_paid', 'paid');

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_number serial unique,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2) not null default 0,
  advance_applied numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  paid numeric(10, 2) not null default 0,
  has_estimate boolean not null default false,
  status public.bill_status not null default 'pending',
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (parent_id, month)
);

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  received_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create type public.payment_method as enum ('upi', 'cash', 'bank');
create type public.payment_status as enum ('to_confirm', 'confirmed', 'rejected');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'upi',
  upi_txn_id text,
  status public.payment_status not null default 'to_confirm',
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.owns_bill(_bill_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.bills where id = _bill_id and parent_id = auth.uid()) $$;

-- Keep bills.paid and bills.status in step with confirmed payments.
create or replace function public.refresh_bill_paid()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  _bill uuid := coalesce(new.bill_id, old.bill_id);
  _paid numeric;
  _total numeric;
begin
  select coalesce(sum(amount), 0) into _paid from public.payments where bill_id = _bill and status = 'confirmed';
  select total into _total from public.bills where id = _bill;
  update public.bills
     set paid = _paid,
         status = case when _paid >= _total then 'paid'::public.bill_status
                       when _paid > 0 then 'partly_paid'::public.bill_status
                       else 'pending'::public.bill_status end
   where id = _bill;
  return null;
end;
$$;

create trigger payments_refresh_bill
  after insert or update or delete on public.payments
  for each row execute function public.refresh_bill_paid();

-- ---------------------------------------------------------------------------
-- Settings, notifications, reminders, booking requests
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'WoofAbode',
  business_address text,
  business_phone text,
  upi_id text,
  upi_payee_name text,
  capacity_limit int not null default 6
);
insert into public.settings (id) values (1);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- One row per reminder sent, so the same reminder is never sent twice on the same channel.
create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  health_record_id uuid not null references public.health_records (id) on delete cascade,
  due_date date not null,
  days_before int not null,
  channel text not null check (channel in ('email', 'whatsapp', 'in_app')),
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now(),
  unique (health_record_id, due_date, days_before, channel)
);

create type public.request_status as enum ('pending', 'approved', 'declined');

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  service text not null check (service in ('day', 'home')),
  start_date date not null,
  end_date date not null,
  note text,
  status public.request_status not null default 'pending',
  admin_note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.dogs enable row level security;
alter table public.health_records enable row level security;
alter table public.rates enable row level security;
alter table public.day_boarding enable row level security;
alter table public.stays enable row level security;
alter table public.bills enable row level security;
alter table public.advances enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_log enable row level security;
alter table public.booking_requests enable row level security;

-- Profiles: own row, admins all. Profiles are created by the sign-up trigger.
create policy "profiles: read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own or admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Roles: read own, admins manage.
create policy "roles: read own or admin" on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
create policy "roles: admin insert" on public.user_roles for insert with check (public.is_admin());
create policy "roles: admin delete" on public.user_roles for delete using (public.is_admin());

-- Dogs: parents manage their own, admins all.
create policy "dogs: read" on public.dogs for select using (owner_id = auth.uid() or public.is_admin());
create policy "dogs: insert" on public.dogs for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "dogs: update" on public.dogs for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "dogs: admin delete" on public.dogs for delete using (public.is_admin());

-- Health records: owner of the dog, or admin.
create policy "health: read" on public.health_records for select using (public.owns_dog(dog_id) or public.is_admin());
create policy "health: insert" on public.health_records for insert with check (public.owns_dog(dog_id) or public.is_admin());
create policy "health: update" on public.health_records for update using (public.owns_dog(dog_id) or public.is_admin());
create policy "health: delete" on public.health_records for delete using (public.owns_dog(dog_id) or public.is_admin());

-- Rates: approved parents can read their dog's rates; only admins change them.
create policy "rates: read" on public.rates for select using ((public.owns_dog(dog_id) and public.is_approved()) or public.is_admin());
create policy "rates: admin write" on public.rates for all using (public.is_admin()) with check (public.is_admin());

-- Bookings and attendance: approved parents read their own; admins manage.
create policy "day: read" on public.day_boarding for select using ((public.owns_dog(dog_id) and public.is_approved()) or public.is_admin());
create policy "day: admin write" on public.day_boarding for all using (public.is_admin()) with check (public.is_admin());
create policy "stays: read" on public.stays for select using ((public.owns_dog(dog_id) and public.is_approved()) or public.is_admin());
create policy "stays: admin write" on public.stays for all using (public.is_admin()) with check (public.is_admin());

-- Bills: approved parents read their own; admins manage.
create policy "bills: read" on public.bills for select using ((parent_id = auth.uid() and public.is_approved()) or public.is_admin());
create policy "bills: admin write" on public.bills for all using (public.is_admin()) with check (public.is_admin());
create policy "advances: read" on public.advances for select using ((parent_id = auth.uid() and public.is_approved()) or public.is_admin());
create policy "advances: admin write" on public.advances for all using (public.is_admin()) with check (public.is_admin());

-- Payments: parents can read theirs and submit a UPI payment for confirmation; only admins confirm.
create policy "payments: read" on public.payments for select using (public.owns_bill(bill_id) or public.is_admin());
create policy "payments: parent submit" on public.payments for insert
  with check ((public.owns_bill(bill_id) and public.is_approved() and status = 'to_confirm') or public.is_admin());
create policy "payments: admin update" on public.payments for update using (public.is_admin());
create policy "payments: admin delete" on public.payments for delete using (public.is_admin());

-- Settings: everyone signed in can read (UPI ID for payment), admins change.
create policy "settings: read" on public.settings for select using (auth.uid() is not null);
create policy "settings: admin update" on public.settings for update using (public.is_admin());

-- Notifications: own only; admins can create.
create policy "notifications: read own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications for update using (user_id = auth.uid());
create policy "notifications: admin insert" on public.notifications for insert with check (public.is_admin());

-- Reminder log: admins only (the reminder job uses the service role).
create policy "reminders: admin read" on public.reminder_log for select using (public.is_admin());

-- Booking requests: approved parents request for their own dogs; admins decide.
create policy "requests: read" on public.booking_requests for select using (public.owns_dog(dog_id) or public.is_admin());
create policy "requests: parent insert" on public.booking_requests for insert
  with check (public.owns_dog(dog_id) and public.is_approved() and status = 'pending');
create policy "requests: admin update" on public.booking_requests for update using (public.is_admin());
