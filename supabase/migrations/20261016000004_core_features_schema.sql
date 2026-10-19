-- Karachi Express POS — Core Features Schema (Phase 2)
-- Adds: recipes, table reservations, suppliers, purchase orders, expenses, customers, branch settings, rider delivery columns.

-- ---------------------------------------------------------------- Branch Settings
alter table public.branches
  add column if not exists currency_symbol text not null default 'Rs.',
  add column if not exists receipt_header text not null default 'Karachi Express — Authentic Flavours',
  add column if not exists receipt_footer text not null default 'Thank you for your visit! Delivery & Info: 021-111-KHI-POS',
  add column if not exists auto_deduct_stock boolean not null default true,
  add column if not exists delivery_fee numeric(12,2) not null default 150.00 check (delivery_fee >= 0),
  add column if not exists service_charge_rate numeric(5,2) not null default 0.00 check (service_charge_rate >= 0 and service_charge_rate <= 100);

-- ---------------------------------------------------------------- Orders Delivery & Rider Extensions
alter table public.orders
  add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  add column if not exists rider_name text,
  add column if not exists rider_phone text,
  add column if not exists rider_status text check (rider_status in ('unassigned', 'assigned', 'out_for_delivery', 'delivered', 'returned')) default 'unassigned',
  add column if not exists rider_cash_collected numeric(12,2) not null default 0 check (rider_cash_collected >= 0),
  add column if not exists rider_cash_handed_over boolean not null default false;

-- ---------------------------------------------------------------- Recipes (Menu Item to Inventory Ingredients)
create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) > 0),
  created_at timestamptz not null default now(),
  unique (menu_item_id, inventory_item_id)
);
create index if not exists recipe_items_menu_idx on public.recipe_items(menu_item_id);
create index if not exists recipe_items_inv_idx on public.recipe_items(inventory_item_id);

-- ---------------------------------------------------------------- Table Reservations
create table if not exists public.table_reservations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) > 0),
  customer_phone text not null check (length(trim(customer_phone)) > 0),
  guest_count int not null check (guest_count > 0),
  reservation_time timestamptz not null,
  status text not null check (status in ('confirmed', 'seated', 'cancelled', 'completed')) default 'confirmed',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists reservations_branch_time_idx on public.table_reservations(branch_id, reservation_time);
create index if not exists reservations_table_idx on public.table_reservations(table_id);

-- ---------------------------------------------------------------- Suppliers & Purchasing
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);
create index if not exists suppliers_branch_idx on public.suppliers(branch_id);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  po_number text not null check (length(trim(po_number)) > 0),
  status text not null check (status in ('draft', 'ordered', 'received', 'cancelled')) default 'draft',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  invoice_no text,
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (branch_id, po_number)
);
create index if not exists po_branch_status_idx on public.purchase_orders(branch_id, status);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0)
);
create index if not exists po_items_po_idx on public.purchase_order_items(purchase_order_id);

-- ---------------------------------------------------------------- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  category text not null check (category in ('utilities', 'salaries', 'maintenance', 'supplies', 'rent', 'marketing', 'raw_materials', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  payment_method public.payment_method not null default 'cash',
  cash_session_id uuid references public.cash_sessions(id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  vendor text,
  receipt_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists expenses_branch_created_idx on public.expenses(branch_id, created_at desc);
create index if not exists expenses_session_idx on public.expenses(cash_session_id) where cash_session_id is not null;

-- ---------------------------------------------------------------- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  email text,
  address text,
  notes text,
  total_orders int not null default 0 check (total_orders >= 0),
  total_spent numeric(12,2) not null default 0 check (total_spent >= 0),
  created_at timestamptz not null default now(),
  unique (branch_id, phone)
);
create index if not exists customers_branch_phone_idx on public.customers(branch_id, phone);

-- ---------------------------------------------------------------- RLS on New Tables
alter table public.recipe_items           enable row level security;
alter table public.table_reservations     enable row level security;
alter table public.suppliers              enable row level security;
alter table public.purchase_orders        enable row level security;
alter table public.purchase_order_items    enable row level security;
alter table public.expenses               enable row level security;
alter table public.customers              enable row level security;

-- Recipe items: readable by all staff in branch, writable by manager/owner
create policy recipe_items_select on public.recipe_items for select to authenticated
  using (public.has_branch_access(branch_id));
create policy recipe_items_insert on public.recipe_items for insert to authenticated
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));
create policy recipe_items_update on public.recipe_items for update to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])))
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));
create policy recipe_items_delete on public.recipe_items for delete to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));

-- Table reservations: readable by staff in branch, writable by owner/manager/cashier/waiter
create policy table_reservations_select on public.table_reservations for select to authenticated
  using (public.has_branch_access(branch_id));
create policy table_reservations_insert on public.table_reservations for insert to authenticated
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager','cashier','waiter']::public.app_role[])));
create policy table_reservations_update on public.table_reservations for update to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager','cashier','waiter']::public.app_role[])))
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager','cashier','waiter']::public.app_role[])));
create policy table_reservations_delete on public.table_reservations for delete to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));

-- Suppliers: readable by staff, writable by owner/manager
create policy suppliers_select on public.suppliers for select to authenticated
  using (public.has_branch_access(branch_id));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])))
  with check (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));
create policy suppliers_delete on public.suppliers for delete to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));

-- Purchase orders & items: read-only from clients for manager/owner; writes go through RPC
create policy purchase_orders_select on public.purchase_orders for select to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));
create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));

-- Expenses: readable by manager/owner/cashier; writes via RPC or manager/owner
create policy expenses_select on public.expenses for select to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager','cashier']::public.app_role[])));

-- Customers: readable and writable by staff in branch
create policy customers_select on public.customers for select to authenticated
  using (public.has_branch_access(branch_id));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.has_branch_access(branch_id));
create policy customers_update on public.customers for update to authenticated
  using (public.has_branch_access(branch_id))
  with check (public.has_branch_access(branch_id));
create policy customers_delete on public.customers for delete to authenticated
  using (public.has_branch_access(branch_id) and (select public.has_role(array['owner','manager']::public.app_role[])));

-- Revoke dangerous direct writes on transactional tables
revoke insert, update, delete, truncate on
  public.purchase_orders, public.purchase_order_items, public.expenses
from anon, authenticated;

