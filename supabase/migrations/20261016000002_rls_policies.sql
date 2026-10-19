-- Karachi Express POS — RLS & authorization helpers (Phase 1)
-- Model:
--   * owner: all branches. Others: only their profiles.branch_id.
--   * Config tables (menu, tables, inventory items): writable by manager/owner.
--   * Transactional tables (orders, payments, cash, stock ledger, audit):
--     READ-ONLY from clients. Writes happen via SECURITY DEFINER RPCs (Phase 2)
--     that validate role, branch, totals and idempotency server-side.

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies on profiles don't recurse. search_path pinned.
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.current_branch_id() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.has_branch_access(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
      and (p.role = 'owner' or p.branch_id = b)
  )
$$;

create or replace function public.has_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = any(roles)
  )
$$;

revoke all on function public.current_role_name(), public.current_branch_id(),
  public.has_branch_access(uuid), public.has_role(public.app_role[]) from public, anon;
grant execute on function public.current_role_name(), public.current_branch_id(),
  public.has_branch_access(uuid), public.has_role(public.app_role[]) to authenticated;

-- ---------------------------------------------------------------- enable RLS
alter table public.branches         enable row level security;
alter table public.profiles         enable row level security;
alter table public.menu_categories  enable row level security;
alter table public.menu_items       enable row level security;
alter table public.dining_tables    enable row level security;
alter table public.order_counters   enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.cash_sessions    enable row level security;
alter table public.cash_movements   enable row level security;
alter table public.payments         enable row level security;
alter table public.inventory_items  enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.audit_log        enable row level security;

-- ---------------------------------------------------------------- branches
create policy branches_select on public.branches for select to authenticated
  using (public.has_branch_access(id));
create policy branches_owner_write on public.branches for all to authenticated
  using (public.has_role(array['owner']::public.app_role[]))
  with check (public.has_role(array['owner']::public.app_role[]));

-- ---------------------------------------------------------------- profiles
-- Users read own profile; managers/owners read their branch's staff.
-- NO client write policy for profiles: role/branch/PIN changes go through RPC,
-- preventing privilege escalation via self-update.
create policy profiles_select_self on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_select_branch on public.profiles for select to authenticated
  using (public.has_role(array['owner','manager']::public.app_role[])
         and (public.current_role_name() = 'owner' or branch_id = public.current_branch_id()));

-- ---------------------------------------------------------------- config tables
create policy menu_categories_select on public.menu_categories for select to authenticated
  using (public.has_branch_access(branch_id));
create policy menu_categories_write on public.menu_categories for all to authenticated
  using (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]))
  with check (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]));

create policy menu_items_select on public.menu_items for select to authenticated
  using (public.has_branch_access(branch_id));
create policy menu_items_write on public.menu_items for all to authenticated
  using (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]))
  with check (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]));

create policy dining_tables_select on public.dining_tables for select to authenticated
  using (public.has_branch_access(branch_id));
create policy dining_tables_write on public.dining_tables for all to authenticated
  using (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]))
  with check (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]));

create policy inventory_items_select on public.inventory_items for select to authenticated
  using (public.has_branch_access(branch_id)
         and public.has_role(array['owner','manager','cashier','kitchen']::public.app_role[]));
create policy inventory_items_write on public.inventory_items for all to authenticated
  using (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]))
  with check (public.has_branch_access(branch_id) and public.has_role(array['owner','manager']::public.app_role[]));

-- ---------------------------------------------------------------- transactional (read-only)
create policy orders_select on public.orders for select to authenticated
  using (public.has_branch_access(branch_id));
create policy order_items_select on public.order_items for select to authenticated
  using (public.has_branch_access(branch_id));

create policy payments_select on public.payments for select to authenticated
  using (public.has_branch_access(branch_id)
         and public.has_role(array['owner','manager','cashier']::public.app_role[]));

create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (public.has_branch_access(branch_id)
         and public.has_role(array['owner','manager','cashier']::public.app_role[]));
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (public.has_branch_access(branch_id)
         and public.has_role(array['owner','manager','cashier']::public.app_role[]));

create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_branch_access(branch_id)
         and public.has_role(array['owner','manager']::public.app_role[]));

create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_role(array['owner','manager']::public.app_role[])
         and (branch_id is null and public.current_role_name() = 'owner'
              or public.has_branch_access(branch_id)));

-- order_counters: no policies => inaccessible to clients; used by RPCs only.

-- ---------------------------------------------------------------- privileges
-- Defense in depth: strip default write grants on transactional tables.
revoke insert, update, delete, truncate on
  public.orders, public.order_items, public.payments, public.cash_sessions,
  public.cash_movements, public.stock_movements, public.audit_log,
  public.order_counters, public.profiles
from anon, authenticated;
revoke all on public.order_counters from anon, authenticated;
revoke all on all tables in schema public from anon;
