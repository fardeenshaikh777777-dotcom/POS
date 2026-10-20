-- Karachi Express POS — Customer CRM & Deals/Promotions Schema
-- Migration: 20261021000009_customer_crm_and_deals.sql

-- 1. Phone Normalizer Helper
create or replace function public.normalize_phone(p_phone text)
returns text language plpgsql immutable as $$
declare
  v_clean text;
begin
  if p_phone is null then return null; end if;
  -- Remove spaces, dashes, parentheses, dots
  v_clean := regexp_replace(trim(p_phone), '[\s\-\(\)\.]', '', 'g');
  if length(v_clean) = 0 then return null; end if;

  -- Pakistan phone normalization:
  -- 03001234567 -> +923001234567
  -- 923001234567 -> +923001234567
  -- 00923001234567 -> +923001234567
  if v_clean ~ '^0092' then
    v_clean := '+' || substring(v_clean from 3);
  elsif v_clean ~ '^03[0-9]{9}$' then
    v_clean := '+92' || substring(v_clean from 2);
  elsif v_clean ~ '^92[0-9]{10}$' then
    v_clean := '+' || v_clean;
  elsif v_clean ~ '^[3][0-9]{9}$' then
    v_clean := '+92' || v_clean;
  elsif not v_clean ~ '^\+' and v_clean ~ '^[0-9]+$' then
    v_clean := '+' || v_clean;
  end if;

  return v_clean;
end;
$$;

-- 2. Customer CRM Enhancements
alter table public.customers
  add column if not exists last_visit_at timestamptz,
  add column if not exists marketing_consent text not null default 'unspecified'
    check (marketing_consent in ('opted_in', 'opted_out', 'unspecified')),
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text;

-- 3. Link Table Reservations to Customers
alter table public.table_reservations
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists reservations_customer_idx
  on public.table_reservations(branch_id, customer_id);

-- 4. Deals & Promotions Tables
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  deal_type text not null check (deal_type in ('combo', 'percentage_discount', 'flat_discount', 'bogo', 'item_discount')),
  discount_type text not null check (discount_type in ('fixed', 'percentage', 'combo_price', 'free_item')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  combo_price numeric(12,2) check (combo_price is null or combo_price >= 0),
  min_order_amount numeric(12,2) check (min_order_amount is null or min_order_amount >= 0),
  max_discount_amount numeric(12,2) check (max_discount_amount is null or max_discount_amount >= 0),
  applicable_order_types text[] not null default array['dine_in', 'takeaway', 'delivery'],
  applicable_weekdays int[] not null default array[0,1,2,3,4,5,6],
  start_time timestamptz not null default now(),
  end_time timestamptz,
  is_active boolean not null default true,
  is_stackable boolean not null default false,
  redemption_limit int check (redemption_limit is null or redemption_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  times_redeemed int not null default 0 check (times_redeemed >= 0),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_branch_active_idx on public.deals(branch_id, is_active);
create index if not exists deals_time_window_idx on public.deals(branch_id, start_time, end_time);

create trigger trg_deals_updated before update on public.deals
  for each row execute function public.set_updated_at();

-- Deal Items / Requirements Table
create table if not exists public.deal_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete cascade,
  required_quantity int not null default 1 check (required_quantity > 0),
  is_free boolean not null default false
);

create index if not exists deal_items_deal_idx on public.deal_items(deal_id);

-- 5. Link Orders to Customers and Deals
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists deal_discount numeric(12,2) not null default 0 check (deal_discount >= 0);

create index if not exists orders_customer_idx on public.orders(branch_id, customer_id);
create index if not exists orders_deal_idx on public.orders(branch_id, deal_id);

-- 6. Enable RLS on Deals and Deal Items
alter table public.deals enable row level security;
alter table public.deal_items enable row level security;

create policy deals_select on public.deals for select to authenticated
  using (public.has_branch_access(branch_id));

create policy deals_insert on public.deals for insert to authenticated
  with check (
    public.has_branch_access(branch_id)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager'))
  );

create policy deals_update on public.deals for update to authenticated
  using (
    public.has_branch_access(branch_id)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager'))
  );

create policy deals_delete on public.deals for delete to authenticated
  using (
    public.has_branch_access(branch_id)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager'))
  );

create policy deal_items_select on public.deal_items for select to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_items.deal_id and public.has_branch_access(d.branch_id)
    )
  );

create policy deal_items_write on public.deal_items for all to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_items.deal_id and public.has_branch_access(d.branch_id)
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager'))
    )
  );

-- 7. Automatic Customer Creation & Linking RPC for Reservations
create or replace function public.save_reservation_with_customer(
  p_branch_id uuid,
  p_table_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_guest_count int,
  p_reservation_time timestamptz,
  p_notes text default null,
  p_marketing_consent text default 'unspecified'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_norm_phone text;
  v_customer_id uuid;
  v_res_id uuid;
  v_conflict_count int;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied to branch %', p_branch_id using errcode = '42501';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Guest name is required';
  end if;

  if p_customer_phone is null or length(trim(p_customer_phone)) = 0 then
    raise exception 'Guest phone number is required';
  end if;

  if p_guest_count <= 0 then
    raise exception 'Guest count must be at least 1';
  end if;

  v_norm_phone := public.normalize_phone(p_customer_phone);

  -- 1. Check reservation table conflict (within 2 hours)
  select count(*) into v_conflict_count
    from public.table_reservations
   where branch_id = p_branch_id
     and table_id = p_table_id
     and status in ('confirmed', 'seated')
     and abs(extract(epoch from (reservation_time - p_reservation_time))) < 7200;

  if v_conflict_count > 0 then
    raise exception 'Table has a conflicting reservation within 2 hours of selected time';
  end if;

  -- 2. Find or create customer profile
  select id into v_customer_id
    from public.customers
   where branch_id = p_branch_id and (phone = v_norm_phone or phone = trim(p_customer_phone));

  if v_customer_id is null then
    insert into public.customers (
      branch_id, name, phone, marketing_consent, marketing_consent_at, marketing_consent_source
    ) values (
      p_branch_id,
      trim(p_customer_name),
      v_norm_phone,
      coalesce(p_marketing_consent, 'unspecified'),
      case when p_marketing_consent in ('opted_in', 'opted_out') then now() else null end,
      'reservation'
    )
    returning id into v_customer_id;
  else
    -- Update consent if explicitly provided
    if p_marketing_consent in ('opted_in', 'opted_out') then
      update public.customers
         set marketing_consent = p_marketing_consent,
             marketing_consent_at = now(),
             marketing_consent_source = 'reservation'
       where id = v_customer_id;
    end if;
  end if;

  -- 3. Insert reservation linked to customer
  insert into public.table_reservations (
    branch_id, table_id, customer_id, customer_name, customer_phone, guest_count, reservation_time, notes, status, created_by
  ) values (
    p_branch_id, p_table_id, v_customer_id, trim(p_customer_name), v_norm_phone, p_guest_count, p_reservation_time, p_notes, 'confirmed', auth.uid()
  )
  returning id into v_res_id;

  return jsonb_build_object(
    'reservation_id', v_res_id,
    'customer_id', v_customer_id,
    'normalized_phone', v_norm_phone,
    'status', 'confirmed'
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.save_reservation_with_customer to authenticated;
grant execute on function public.normalize_phone to authenticated;
