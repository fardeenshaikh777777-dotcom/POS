-- Karachi Express POS — Migration 000007: Fix Dashboard Metrics RPC
-- Counts both 'completed' and 'served' orders as delivered/completed.
-- Provides sensible defaults for date filters and JSON aggregations.

create or replace function public.get_owner_dashboard_metrics(
  p_branch_id uuid,
  p_start_date date default (now() at time zone 'Asia/Karachi')::date,
  p_end_date date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_start date := coalesce(p_start_date, (now() at time zone 'Asia/Karachi')::date);
  v_end date := coalesce(p_end_date, v_start);
  v_total_orders int := 0;
  v_completed_orders int := 0;
  v_cancelled_orders int := 0;
  v_gross_sales numeric(12,2) := 0;
  v_total_discounts numeric(12,2) := 0;
  v_total_tax numeric(12,2) := 0;
  v_net_sales numeric(12,2) := 0;
  v_avg_order_value numeric(12,2) := 0;
  v_payments_by_method jsonb := '{"cash": 0, "card": 0, "jazzcash": 0, "easypaisa": 0}'::jsonb;
  v_orders_by_type jsonb := '{"dine_in": 0, "delivery": 0, "takeaway": 0}'::jsonb;
  v_total_expenses numeric(12,2) := 0;
  v_low_stock_count int := 0;
  v_active_session jsonb := null;
  v_top_items jsonb := '[]'::jsonb;
  v_open_tables int := 0;
  v_occupied_tables int := 0;
  v_temp_payments jsonb;
  v_temp_orders jsonb;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- 1. Orders stats (counts both 'completed' and 'served' as completed/delivered)
  select
    count(*),
    count(*) filter (where status in ('completed', 'served')),
    count(*) filter (where status = 'cancelled'),
    coalesce(sum(subtotal) filter (where status <> 'cancelled'), 0),
    coalesce(sum(discount) filter (where status <> 'cancelled'), 0),
    coalesce(sum(tax) filter (where status <> 'cancelled'), 0),
    coalesce(sum(total) filter (where status <> 'cancelled'), 0)
  into
    v_total_orders, v_completed_orders, v_cancelled_orders,
    v_gross_sales, v_total_discounts, v_total_tax, v_net_sales
  from public.orders
  where branch_id = p_branch_id and business_date between v_start and v_end;

  if v_total_orders - v_cancelled_orders > 0 then
    v_avg_order_value := round(v_net_sales / (v_total_orders - v_cancelled_orders), 2);
  end if;

  -- 2. Payments breakdown
  select jsonb_object_agg(method, total_amount)
    into v_temp_payments
    from (
      select p.method, coalesce(sum(p.amount), 0) as total_amount
        from public.payments p
        join public.orders o on o.id = p.order_id
       where p.branch_id = p_branch_id
         and p.status = 'succeeded'
         and o.business_date between v_start and v_end
       group by p.method
    ) s;

  if v_temp_payments is not null then
    v_payments_by_method := v_payments_by_method || v_temp_payments;
  end if;

  -- 3. Orders by type
  select jsonb_object_agg(type, count)
    into v_temp_orders
    from (
      select type, count(*) as count
        from public.orders
       where branch_id = p_branch_id
         and business_date between v_start and v_end
       group by type
    ) s;

  if v_temp_orders is not null then
    v_orders_by_type := v_orders_by_type || v_temp_orders;
  end if;

  -- 4. Total expenses
  select coalesce(sum(amount), 0) into v_total_expenses
    from public.expenses
   where branch_id = p_branch_id
     and (created_at at time zone 'Asia/Karachi')::date between v_start and v_end;

  -- 5. Low stock items count
  select count(*) into v_low_stock_count
    from public.inventory_items
   where branch_id = p_branch_id and is_active and current_qty <= reorder_level;

  -- 6. Active open cash session
  select jsonb_build_object(
    'id', cs.id,
    'opened_at', cs.opened_at,
    'opening_float', cs.opening_float,
    'opened_by_name', pr.full_name
  ) into v_active_session
  from public.cash_sessions cs
  join public.profiles pr on pr.id = cs.opened_by
  where cs.branch_id = p_branch_id and cs.closed_at is null
  limit 1;

  -- 7. Table occupancy
  select
    count(*),
    count(*) filter (where exists (
      select 1 from public.orders o
       where o.table_id = dt.id and o.status in ('open', 'sent_to_kitchen', 'preparing', 'ready', 'served')
    ))
  into v_open_tables, v_occupied_tables
  from public.dining_tables dt
  where dt.branch_id = p_branch_id and dt.is_active;

  -- 8. Top 5 items
  select coalesce(jsonb_agg(item_row), '[]'::jsonb)
    into v_top_items
    from (
      select oi.item_name, sum(oi.quantity) as qty_sold, sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where oi.branch_id = p_branch_id
         and o.status <> 'cancelled'
         and o.business_date between v_start and v_end
       group by oi.item_name
       order by qty_sold desc
       limit 5
    ) item_row;

  return jsonb_build_object(
    'total_orders', v_total_orders,
    'completed_orders', v_completed_orders,
    'cancelled_orders', v_cancelled_orders,
    'gross_sales', v_gross_sales,
    'total_discounts', v_total_discounts,
    'total_tax', v_total_tax,
    'net_sales', v_net_sales,
    'average_order_value', v_avg_order_value,
    'total_expenses', v_total_expenses,
    'low_stock_count', v_low_stock_count,
    'payments_by_method', v_payments_by_method,
    'orders_by_type', v_orders_by_type,
    'top_items', v_top_items,
    'active_session', v_active_session,
    'open_tables', v_open_tables,
    'occupied_tables', v_occupied_tables
  );
end $$;

grant execute on function public.get_owner_dashboard_metrics(uuid, date, date) to authenticated;
