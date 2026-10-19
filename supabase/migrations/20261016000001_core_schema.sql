-- Karachi Express POS — core schema (Phase 1)
-- Conventions: snake_case, uuid PKs, timestamptz, money as numeric(12,2) PKR,
-- every operational table carries branch_id for RLS isolation.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('owner', 'manager', 'cashier', 'waiter', 'kitchen');
create type public.order_type as enum ('dine_in', 'takeaway', 'delivery');
create type public.order_status as enum ('open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.stock_reason as enum ('purchase', 'sale', 'waste', 'adjustment', 'opening', 'return');
create type public.cash_movement_kind as enum ('expense', 'pay_in', 'pay_out');

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- branches
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  city text not null default 'Karachi',
  address text,
  phone text,
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- profiles
-- One row per auth user. Owners have branch_id NULL (all branches).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  role public.app_role not null,
  full_name text not null check (length(trim(full_name)) > 0),
  -- PIN is OPTIONAL, hashed (crypt/bcrypt), never defaulted. Set via RPC in Phase 2.
  pin_hash text,
  pin_set_at timestamptz,
  pin_failed_attempts int not null default 0,
  pin_locked_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_branch_required check (role = 'owner' or branch_id is not null)
);
create index profiles_branch_idx on public.profiles(branch_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- menu
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name)
);
create trigger trg_menu_categories_updated before update on public.menu_categories
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text,
  price numeric(12,2) not null check (price >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name)
);
create index menu_items_category_idx on public.menu_items(category_id);
create trigger trg_menu_items_updated before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- tables
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  seats int not null default 4 check (seats > 0),
  is_active boolean not null default true,
  unique (branch_id, label)
);

-- ---------------------------------------------------------------- orders
create table public.order_counters (
  branch_id uuid not null references public.branches(id) on delete cascade,
  business_date date not null,
  last_number int not null default 0,
  primary key (branch_id, business_date)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_number int not null,
  business_date date not null default (now() at time zone 'Asia/Karachi')::date,
  -- Idempotency key generated by the client; defeats duplicate submissions
  -- and offline-queue replays.
  client_request_id uuid not null,
  type public.order_type not null,
  status public.order_status not null default 'open',
  table_id uuid references public.dining_tables(id) on delete set null,
  customer_name text,
  customer_phone text,
  delivery_address text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, client_request_id),
  unique (branch_id, business_date, order_number),
  constraint orders_dine_in_table check (type <> 'dine_in' or table_id is not null),
  constraint orders_discount_le_subtotal check (discount <= subtotal)
);
create index orders_branch_status_idx on public.orders(branch_id, status);
create index orders_branch_created_idx on public.orders(branch_id, created_at desc);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  item_name text not null,            -- snapshot
  unit_price numeric(12,2) not null check (unit_price >= 0), -- snapshot
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  notes text
);
create index order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------- cash sessions
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null check (opening_float >= 0),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  -- Server-computed at close time, never trusted from the client.
  expected_cash numeric(12,2),
  counted_cash numeric(12,2) check (counted_cash is null or counted_cash >= 0),
  variance numeric(12,2),
  notes text,
  constraint cash_sessions_closed_consistent check (
    (closed_at is null and counted_cash is null and expected_cash is null)
    or (closed_at is not null and counted_cash is not null and expected_cash is not null)
  )
);
-- Only one open session per branch.
create unique index cash_sessions_one_open_idx on public.cash_sessions(branch_id) where closed_at is null;

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  cash_session_id uuid not null references public.cash_sessions(id) on delete restrict,
  kind public.cash_movement_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cash_movements_session_idx on public.cash_movements(cash_session_id);

-- ---------------------------------------------------------------- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount > 0),
  cash_session_id uuid references public.cash_sessions(id) on delete restrict,
  -- External gateway reference; unique per method so webhook replays are idempotent.
  provider_reference text,
  idempotency_key uuid not null,
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (branch_id, idempotency_key),
  constraint payments_cash_needs_session check (method <> 'cash' or cash_session_id is not null)
);
create unique index payments_provider_ref_idx on public.payments(method, provider_reference)
  where provider_reference is not null;
create index payments_order_idx on public.payments(order_id);
create index payments_session_idx on public.payments(cash_session_id) where cash_session_id is not null;

-- ---------------------------------------------------------------- inventory
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  -- Maintained ONLY by trigger from stock_movements. Never negative.
  current_qty numeric(14,3) not null default 0 check (current_qty >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

-- Append-only ledger.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  delta numeric(14,3) not null check (delta <> 0),
  reason public.stock_reason not null,
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements(inventory_item_id, created_at desc);

create or replace function public.apply_stock_movement() returns trigger
language plpgsql as $$
begin
  update public.inventory_items
     set current_qty = current_qty + new.delta
   where id = new.inventory_item_id and branch_id = new.branch_id;
  if not found then
    raise exception 'inventory item % not found in branch', new.inventory_item_id;
  end if;
  return new;
end $$;
create trigger trg_stock_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% on % is not allowed (append-only)', tg_op, tg_table_name;
end $$;
create trigger trg_stock_immutable before update or delete on public.stock_movements
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------- audit log
create table public.audit_log (
  id bigint generated always as identity primary key,
  branch_id uuid references public.branches(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_branch_idx on public.audit_log(branch_id, created_at desc);
create trigger trg_audit_immutable before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();
