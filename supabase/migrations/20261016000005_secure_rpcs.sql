-- Karachi Express POS — Secure RPCs (Phase 2)
-- All RPCs are SECURITY DEFINER with set search_path = public, granted only to authenticated.

-- ---------------------------------------------------------------- create_order
create or replace function public.create_order(
  p_branch_id uuid,
  p_client_request_id uuid,
  p_type public.order_type,
  p_table_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_delivery_address text default null,
  p_notes text default null,
  p_discount numeric default 0,
  p_delivery_fee numeric default 0,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_existing_id uuid;
  v_next_num int;
  v_order_id uuid;
  v_tax_rate numeric(5,2);
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_menu_item record;
  v_item_qty int;
  v_item_notes text;
  v_line_total numeric(12,2);
  v_res jsonb;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied to branch %', p_branch_id using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot create an empty order';
  end if;

  if p_type = 'dine_in' and p_table_id is null then
    raise exception 'Dine-in orders require a table';
  end if;

  -- 1. Idempotency check: if client_request_id already exists in this branch, return it
  select id into v_existing_id from public.orders
   where branch_id = p_branch_id and client_request_id = p_client_request_id;
  if v_existing_id is not null then
    select jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'business_date', o.business_date,
      'subtotal', o.subtotal,
      'tax', o.tax,
      'total', o.total,
      'status', o.status,
      'is_duplicate_replay', true
    ) into v_res from public.orders o where o.id = v_existing_id;
    return v_res;
  end if;

  -- 2. Atomic sequence for order_number per branch per business_date
  insert into public.order_counters (branch_id, business_date, last_number)
  values (p_branch_id, v_today, 1)
  on conflict (branch_id, business_date)
  do update set last_number = public.order_counters.last_number + 1
  returning last_number into v_next_num;

  -- 3. Fetch branch tax rate
  select tax_rate into v_tax_rate from public.branches where id = p_branch_id;
  if v_tax_rate is null then v_tax_rate := 0; end if;

  -- 4. Create order placeholder
  v_order_id := gen_random_uuid();

  -- 5. Calculate line totals from database snapshots
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_qty := coalesce((v_item->>'quantity')::int, 1);
    v_item_notes := v_item->>'notes';
    if v_item_qty <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    select id, name, price, is_available into v_menu_item
      from public.menu_items
     where id = (v_item->>'menu_item_id')::uuid and branch_id = p_branch_id;

    if not found then
      raise exception 'Menu item % not found in branch', v_item->>'menu_item_id';
    end if;

    if not v_menu_item.is_available then
      raise exception 'Menu item "%" is currently unavailable', v_menu_item.name;
    end if;

    v_line_total := round(v_menu_item.price * v_item_qty, 2);
    v_subtotal := v_subtotal + v_line_total;

    insert into public.order_items (
      order_id, branch_id, menu_item_id, item_name, unit_price, quantity, line_total, notes
    ) values (
      v_order_id, p_branch_id, v_menu_item.id, v_menu_item.name, v_menu_item.price, v_item_qty, v_line_total, v_item_notes
    );
  end loop;

  if p_discount > v_subtotal then
    raise exception 'Discount cannot exceed subtotal';
  end if;

  v_tax := round(((v_subtotal - coalesce(p_discount, 0)) * v_tax_rate) / 100, 2);
  v_total := (v_subtotal - coalesce(p_discount, 0)) + v_tax + coalesce(p_delivery_fee, 0);

  insert into public.orders (
    id, branch_id, order_number, business_date, client_request_id, type, status,
    table_id, customer_name, customer_phone, delivery_address, delivery_fee,
    subtotal, discount, tax, total, notes, created_by
  ) values (
    v_order_id, p_branch_id, v_next_num, v_today, p_client_request_id, p_type, 'open',
    p_table_id, p_customer_name, p_customer_phone, p_delivery_address, coalesce(p_delivery_fee, 0),
    v_subtotal, coalesce(p_discount, 0), v_tax, v_total, p_notes, v_caller_id
  );

  -- 6. Upsert customer record if phone is supplied
  if p_customer_phone is not null and length(trim(p_customer_phone)) > 0 then
    insert into public.customers (branch_id, name, phone, address, total_orders, total_spent)
    values (p_branch_id, coalesce(p_customer_name, 'Guest'), trim(p_customer_phone), p_delivery_address, 1, v_total)
    on conflict (branch_id, phone)
    do update set
      total_orders = public.customers.total_orders + 1,
      total_spent = public.customers.total_spent + excluded.total_spent,
      name = case when public.customers.name is null or public.customers.name = 'Guest' then excluded.name else public.customers.name end,
      address = coalesce(excluded.address, public.customers.address);
  end if;

  -- 7. Audit log
  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (p_branch_id, v_caller_id, 'create_order', 'orders', v_order_id::text, jsonb_build_object(
    'order_number', v_next_num,
    'total', v_total,
    'type', p_type
  ));

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_next_num,
    'business_date', v_today,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total,
    'status', 'open',
    'is_duplicate_replay', false
  );
end $$;

-- ---------------------------------------------------------------- update_order_status
create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_order record;
  v_item record;
  v_recipe record;
  v_already_deducted boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if not public.has_branch_access(v_order.branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_order.status in ('completed', 'cancelled') and p_new_status <> v_order.status then
    raise exception 'Cannot change status of a % order', v_order.status;
  end if;

  -- Check recipe stock deduction:
  -- When order moves to 'sent_to_kitchen' or 'preparing' or 'completed'
  if p_new_status in ('sent_to_kitchen', 'preparing') then
    select exists (
      select 1 from public.stock_movements where order_id = p_order_id and reason = 'sale'
    ) into v_already_deducted;

    if not v_already_deducted then
      -- Deduct ingredients for all order items that have recipes
      for v_item in select menu_item_id, quantity from public.order_items where order_id = p_order_id
      loop
        for v_recipe in select inventory_item_id, quantity, unit
                          from public.recipe_items
                         where menu_item_id = v_item.menu_item_id
        loop
          insert into public.stock_movements (
            branch_id, inventory_item_id, delta, reason, order_id, note, created_by
          ) values (
            v_order.branch_id,
            v_recipe.inventory_item_id,
            -(v_recipe.quantity * v_item.quantity),
            'sale',
            p_order_id,
            'Order #' || v_order.order_number || ' recipe consumption',
            v_caller_id
          );
        end loop;
      end loop;
    end if;
  end if;

  -- If order cancelled and stock was deducted, reverse the stock deduction!
  if p_new_status = 'cancelled' then
    select exists (
      select 1 from public.stock_movements where order_id = p_order_id and reason = 'sale'
    ) into v_already_deducted;

    if v_already_deducted then
      insert into public.stock_movements (
        branch_id, inventory_item_id, delta, reason, order_id, note, created_by
      )
      select
        branch_id, inventory_item_id, abs(delta), 'return', order_id,
        'Order #' || v_order.order_number || ' cancellation reversal', v_caller_id
      from public.stock_movements
      where order_id = p_order_id and reason = 'sale';
    end if;
  end if;

  update public.orders
     set status = p_new_status,
         notes = coalesce(p_notes, notes),
         updated_at = now()
   where id = p_order_id;

  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (v_order.branch_id, v_caller_id, 'update_order_status', 'orders', p_order_id::text, jsonb_build_object(
    'old_status', v_order.status,
    'new_status', p_new_status,
    'notes', p_notes
  ));

  return jsonb_build_object('id', p_order_id, 'status', p_new_status);
end $$;

-- ---------------------------------------------------------------- settle_payment
create or replace function public.settle_payment(
  p_branch_id uuid,
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_idempotency_key uuid,
  p_cash_session_id uuid default null,
  p_provider_ref text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_order record;
  v_payment_id uuid;
  v_session record;
  v_total_paid numeric(12,2);
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- 1. Check idempotency
  select id into v_payment_id from public.payments
   where branch_id = p_branch_id and idempotency_key = p_idempotency_key;
  if v_payment_id is not null then
    return jsonb_build_object('id', v_payment_id, 'is_duplicate_replay', true);
  end if;

  -- 2. Verify order
  select * into v_order from public.orders where id = p_order_id and branch_id = p_branch_id;
  if not found then
    raise exception 'Order % not found in branch', p_order_id;
  end if;

  -- 3. If cash, verify open session
  if p_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Cash payments require an active cash session';
    end if;
    select * into v_session from public.cash_sessions
     where id = p_cash_session_id and branch_id = p_branch_id and closed_at is null;
    if not found then
      raise exception 'Cash session % is not active or closed', p_cash_session_id;
    end if;
  end if;

  v_payment_id := gen_random_uuid();
  insert into public.payments (
    id, branch_id, order_id, method, status, amount,
    cash_session_id, provider_reference, idempotency_key, received_by, confirmed_at
  ) values (
    v_payment_id, p_branch_id, p_order_id, p_method, 'succeeded', p_amount,
    p_cash_session_id, p_provider_ref, p_idempotency_key, v_caller_id, now()
  );

  -- 4. If delivery order and cash collected by rider
  if v_order.type = 'delivery' and p_method = 'cash' then
    update public.orders
       set rider_cash_collected = rider_cash_collected + p_amount,
           rider_cash_handed_over = true
     where id = p_order_id;
  end if;

  -- 5. Calculate total paid
  select coalesce(sum(amount), 0) into v_total_paid
    from public.payments
   where order_id = p_order_id and status = 'succeeded';

  -- If fully paid and currently served or ready, we can auto-complete
  if v_total_paid >= v_order.total and v_order.status in ('served', 'ready') then
    update public.orders set status = 'completed', updated_at = now() where id = p_order_id;
  end if;

  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (p_branch_id, v_caller_id, 'settle_payment', 'payments', v_payment_id::text, jsonb_build_object(
    'order_id', p_order_id,
    'amount', p_amount,
    'method', p_method,
    'total_paid', v_total_paid,
    'order_total', v_order.total
  ));

  return jsonb_build_object(
    'id', v_payment_id,
    'order_id', p_order_id,
    'amount', p_amount,
    'total_paid', v_total_paid,
    'order_total', v_order.total,
    'is_fully_paid', (v_total_paid >= v_order.total),
    'is_duplicate_replay', false
  );
end $$;

-- ---------------------------------------------------------------- open_cash_session
create or replace function public.open_cash_session(
  p_branch_id uuid,
  p_opening_float numeric,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_existing_id uuid;
  v_session_id uuid;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_opening_float < 0 then
    raise exception 'Opening float cannot be negative';
  end if;

  -- Check if already an open session
  select id into v_existing_id from public.cash_sessions
   where branch_id = p_branch_id and closed_at is null;
  if v_existing_id is not null then
    raise exception 'There is already an open cash session for this branch';
  end if;

  v_session_id := gen_random_uuid();
  insert into public.cash_sessions (
    id, branch_id, opened_by, opened_at, opening_float, notes
  ) values (
    v_session_id, p_branch_id, v_caller_id, now(), p_opening_float, p_notes
  );

  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (p_branch_id, v_caller_id, 'open_cash_session', 'cash_sessions', v_session_id::text, jsonb_build_object(
    'opening_float', p_opening_float
  ));

  return jsonb_build_object('id', v_session_id, 'opening_float', p_opening_float, 'opened_at', now());
end $$;

-- ---------------------------------------------------------------- close_cash_session
create or replace function public.close_cash_session(
  p_session_id uuid,
  p_counted_cash numeric,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_session record;
  v_cash_sales numeric(12,2) := 0;
  v_pay_ins numeric(12,2) := 0;
  v_pay_outs numeric(12,2) := 0;
  v_expenses numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_variance numeric(12,2);
begin
  select * into v_session from public.cash_sessions where id = p_session_id;
  if not found then
    raise exception 'Session % not found', p_session_id;
  end if;

  if v_session.closed_at is not null then
    raise exception 'Session is already closed';
  end if;

  if not public.has_branch_access(v_session.branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_counted_cash < 0 then
    raise exception 'Counted cash cannot be negative';
  end if;

  -- 1. Succeeded cash payments
  select coalesce(sum(amount), 0) into v_cash_sales
    from public.payments
   where cash_session_id = p_session_id and status = 'succeeded' and method = 'cash';

  -- 2. Pay-in cash movements
  select coalesce(sum(amount), 0) into v_pay_ins
    from public.cash_movements
   where cash_session_id = p_session_id and kind = 'pay_in';

  -- 3. Pay-out cash movements
  select coalesce(sum(amount), 0) into v_pay_outs
    from public.cash_movements
   where cash_session_id = p_session_id and kind = 'pay_out';

  -- 4. Cash movements of kind expense + expenses linked
  select coalesce(sum(amount), 0) into v_expenses
    from public.expenses
   where cash_session_id = p_session_id and payment_method = 'cash';

  -- Expected = float + sales + pay_ins - pay_outs - expenses
  v_expected := v_session.opening_float + v_cash_sales + v_pay_ins - v_pay_outs - v_expenses;
  v_variance := p_counted_cash - v_expected;

  update public.cash_sessions
     set closed_at = now(),
         closed_by = v_caller_id,
         expected_cash = v_expected,
         counted_cash = p_counted_cash,
         variance = v_variance,
         notes = coalesce(p_notes, notes)
   where id = p_session_id;

  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (v_session.branch_id, v_caller_id, 'close_cash_session', 'cash_sessions', p_session_id::text, jsonb_build_object(
    'opening_float', v_session.opening_float,
    'cash_sales', v_cash_sales,
    'pay_ins', v_pay_ins,
    'pay_outs', v_pay_outs,
    'expenses', v_expenses,
    'expected_cash', v_expected,
    'counted_cash', p_counted_cash,
    'variance', v_variance
  ));

  return jsonb_build_object(
    'id', p_session_id,
    'opening_float', v_session.opening_float,
    'cash_sales', v_cash_sales,
    'expected_cash', v_expected,
    'counted_cash', p_counted_cash,
    'variance', v_variance,
    'closed_at', now()
  );
end $$;

-- ---------------------------------------------------------------- record_cash_movement
create or replace function public.record_cash_movement(
  p_session_id uuid,
  p_kind public.cash_movement_kind,
  p_amount numeric,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_session record;
  v_id uuid;
begin
  select * into v_session from public.cash_sessions where id = p_session_id and closed_at is null;
  if not found then
    raise exception 'Cash session is closed or does not exist';
  end if;

  if not public.has_branch_access(v_session.branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_id := gen_random_uuid();
  insert into public.cash_movements (
    id, branch_id, cash_session_id, kind, amount, reason, created_by
  ) values (
    v_id, v_session.branch_id, p_session_id, p_kind, p_amount, trim(p_reason), v_caller_id
  );

  return jsonb_build_object('id', v_id, 'amount', p_amount, 'kind', p_kind);
end $$;

-- ---------------------------------------------------------------- record_expense
create or replace function public.record_expense(
  p_branch_id uuid,
  p_category text,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_cash_session_id uuid,
  p_description text,
  p_vendor text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_id uuid;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_payment_method = 'cash' and p_cash_session_id is not null then
    -- Verify session is open
    if not exists (select 1 from public.cash_sessions where id = p_cash_session_id and closed_at is null) then
      raise exception 'Cash session is closed';
    end if;
  end if;

  v_id := gen_random_uuid();
  insert into public.expenses (
    id, branch_id, category, amount, payment_method, cash_session_id,
    description, vendor, created_by
  ) values (
    v_id, p_branch_id, p_category, p_amount, p_payment_method, p_cash_session_id,
    trim(p_description), p_vendor, v_caller_id
  );

  insert into public.audit_log (branch_id, actor_id, action, entity, entity_id, details)
  values (p_branch_id, v_caller_id, 'record_expense', 'expenses', v_id::text, jsonb_build_object(
    'amount', p_amount,
    'category', p_category,
    'payment_method', p_payment_method
  ));

  return jsonb_build_object('id', v_id, 'amount', p_amount, 'category', p_category);
end $$;

-- ---------------------------------------------------------------- adjust_stock
create or replace function public.adjust_stock(
  p_branch_id uuid,
  p_inventory_item_id uuid,
  p_delta numeric,
  p_reason public.stock_reason,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_id uuid;
  v_new_qty numeric;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_delta = 0 then
    raise exception 'Stock delta cannot be zero';
  end if;

  v_id := gen_random_uuid();
  insert into public.stock_movements (
    id, branch_id, inventory_item_id, delta, reason, note, created_by
  ) values (
    v_id, p_branch_id, p_inventory_item_id, p_delta, p_reason, p_note, v_caller_id
  );

  select current_qty into v_new_qty from public.inventory_items where id = p_inventory_item_id;

  return jsonb_build_object('id', v_id, 'new_qty', v_new_qty);
end $$;

-- ---------------------------------------------------------------- create_purchase_order
create or replace function public.create_purchase_order(
  p_branch_id uuid,
  p_supplier_id uuid,
  p_po_number text,
  p_invoice_no text default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_po_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_item_qty numeric(14,3);
  v_item_cost numeric(12,2);
  v_line_cost numeric(12,2);
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  v_po_id := gen_random_uuid();

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_qty := (v_item->>'quantity')::numeric;
    v_item_cost := (v_item->>'unit_cost')::numeric;
    v_line_cost := round(v_item_qty * v_item_cost, 2);
    v_total := v_total + v_line_cost;

    insert into public.purchase_order_items (
      purchase_order_id, branch_id, inventory_item_id, quantity, unit_cost, total_cost
    ) values (
      v_po_id, p_branch_id, (v_item->>'inventory_item_id')::uuid, v_item_qty, v_item_cost, v_line_cost
    );
  end loop;

  insert into public.purchase_orders (
    id, branch_id, supplier_id, po_number, status, total_amount, invoice_no, notes, ordered_at, created_by
  ) values (
    v_po_id, p_branch_id, p_supplier_id, trim(p_po_number), 'ordered', v_total, p_invoice_no, p_notes, now(), v_caller_id
  );

  return jsonb_build_object('id', v_po_id, 'po_number', p_po_number, 'total', v_total);
end $$;

-- ---------------------------------------------------------------- receive_purchase_order
create or replace function public.receive_purchase_order(
  p_po_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_po record;
  v_item record;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if not found then
    raise exception 'Purchase order not found';
  end if;

  if not public.has_branch_access(v_po.branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_po.status = 'received' then
    raise exception 'Purchase order already received';
  end if;

  -- Add stock movement for each item
  for v_item in select * from public.purchase_order_items where purchase_order_id = p_po_id
  loop
    insert into public.stock_movements (
      branch_id, inventory_item_id, delta, reason, note, created_by
    ) values (
      v_po.branch_id, v_item.inventory_item_id, v_item.quantity, 'purchase',
      'Received PO #' || v_po.po_number, v_caller_id
    );
  end loop;

  update public.purchase_orders
     set status = 'received', received_at = now()
   where id = p_po_id;

  return jsonb_build_object('id', p_po_id, 'status', 'received');
end $$;

-- ---------------------------------------------------------------- staff PIN functions
create or replace function public.verify_staff_pin(
  p_pin text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_prof record;
  v_matches boolean;
begin
  select * into v_prof from public.profiles where id = v_caller_id;
  if not found or not v_prof.is_active then
    raise exception 'Active profile not found';
  end if;

  if v_prof.pin_hash is null then
    raise exception 'PIN is not set for this account';
  end if;

  if v_prof.pin_locked_until is not null and v_prof.pin_locked_until > now() then
    raise exception 'PIN is locked due to too many failed attempts until %', v_prof.pin_locked_until;
  end if;

  v_matches := (v_prof.pin_hash = crypt(p_pin, v_prof.pin_hash));

  if v_matches then
    update public.profiles
       set pin_failed_attempts = 0, pin_locked_until = null
     where id = v_caller_id;
    return true;
  else
    if v_prof.pin_failed_attempts >= 4 then
      update public.profiles
         set pin_failed_attempts = v_prof.pin_failed_attempts + 1,
             pin_locked_until = now() + interval '15 minutes'
       where id = v_caller_id;
      raise exception 'Incorrect PIN. Account locked for 15 minutes.';
    else
      update public.profiles
         set pin_failed_attempts = v_prof.pin_failed_attempts + 1
       where id = v_caller_id;
      return false;
    end if;
  end if;
end $$;

create or replace function public.set_staff_pin(
  p_user_id uuid,
  p_pin text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if length(p_pin) < 4 or length(p_pin) > 8 then
    raise exception 'PIN must be between 4 and 8 digits';
  end if;

  -- Only user themselves or manager/owner can set PIN
  if v_caller_id <> p_user_id and not (select public.has_role(array['owner','manager']::public.app_role[])) then
    raise exception 'Access denied to set PIN' using errcode = '42501';
  end if;

  update public.profiles
     set pin_hash = crypt(p_pin, gen_salt('bf', 8)),
         pin_set_at = now(),
         pin_failed_attempts = 0,
         pin_locked_until = null
   where id = p_user_id;

  return true;
end $$;

-- ---------------------------------------------------------------- get_owner_dashboard_metrics
create or replace function public.get_owner_dashboard_metrics(
  p_branch_id uuid,
  p_start_date date default (now() at time zone 'Asia/Karachi')::date,
  p_end_date date default (now() at time zone 'Asia/Karachi')::date
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total_orders int := 0;
  v_completed_orders int := 0;
  v_cancelled_orders int := 0;
  v_gross_sales numeric(12,2) := 0;
  v_total_discounts numeric(12,2) := 0;
  v_total_tax numeric(12,2) := 0;
  v_net_sales numeric(12,2) := 0;
  v_avg_order_value numeric(12,2) := 0;
  v_payments_by_method jsonb := '{}'::jsonb;
  v_orders_by_type jsonb := '{}'::jsonb;
  v_total_expenses numeric(12,2) := 0;
  v_low_stock_count int := 0;
  v_active_session jsonb := null;
  v_top_items jsonb := '[]'::jsonb;
  v_open_tables int := 0;
  v_occupied_tables int := 0;
begin
  if not public.has_branch_access(p_branch_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Orders stats
  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'cancelled'),
    coalesce(sum(subtotal) filter (where status <> 'cancelled'), 0),
    coalesce(sum(discount) filter (where status <> 'cancelled'), 0),
    coalesce(sum(tax) filter (where status <> 'cancelled'), 0),
    coalesce(sum(total) filter (where status <> 'cancelled'), 0)
  into
    v_total_orders, v_completed_orders, v_cancelled_orders,
    v_gross_sales, v_total_discounts, v_total_tax, v_net_sales
  from public.orders
  where branch_id = p_branch_id and business_date between p_start_date and p_end_date;

  if v_total_orders - v_cancelled_orders > 0 then
    v_avg_order_value := round(v_net_sales / (v_total_orders - v_cancelled_orders), 2);
  end if;

  -- Payments breakdown
  select jsonb_object_agg(method, total_amount)
    into v_payments_by_method
    from (
      select p.method, coalesce(sum(p.amount), 0) as total_amount
        from public.payments p
        join public.orders o on o.id = p.order_id
       where p.branch_id = p_branch_id
         and p.status = 'succeeded'
         and o.business_date between p_start_date and p_end_date
       group by p.method
    ) s;

  -- Orders by type
  select jsonb_object_agg(type, count)
    into v_orders_by_type
    from (
      select type, count(*) as count
        from public.orders
       where branch_id = p_branch_id
         and business_date between p_start_date and p_end_date
       group by type
    ) s;

  -- Total expenses
  select coalesce(sum(amount), 0) into v_total_expenses
    from public.expenses
   where branch_id = p_branch_id
     and (created_at at time zone 'Asia/Karachi')::date between p_start_date and p_end_date;

  -- Low stock items count
  select count(*) into v_low_stock_count
    from public.inventory_items
   where branch_id = p_branch_id and is_active and current_qty <= reorder_level;

  -- Active open cash session
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

  -- Table occupancy
  select
    count(*),
    count(*) filter (where exists (
      select 1 from public.orders o
       where o.table_id = dt.id and o.status in ('open', 'sent_to_kitchen', 'preparing', 'ready', 'served')
    ))
  into v_open_tables, v_occupied_tables
  from public.dining_tables dt
  where dt.branch_id = p_branch_id and dt.is_active;

  -- Top 5 items
  select coalesce(jsonb_agg(item_row), '[]'::jsonb)
    into v_top_items
    from (
      select oi.item_name, sum(oi.quantity) as qty_sold, sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where oi.branch_id = p_branch_id
         and o.status <> 'cancelled'
         and o.business_date between p_start_date and p_end_date
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
    'payments_by_method', coalesce(v_payments_by_method, '{}'::jsonb),
    'orders_by_type', coalesce(v_orders_by_type, '{}'::jsonb),
    'top_items', v_top_items,
    'active_session', v_active_session,
    'open_tables', v_open_tables,
    'occupied_tables', v_occupied_tables
  );
end $$;

-- ---------------------------------------------------------------- grant permissions
grant execute on function public.create_order(uuid, uuid, public.order_type, uuid, text, text, text, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.settle_payment(uuid, uuid, public.payment_method, numeric, uuid, uuid, text) to authenticated;
grant execute on function public.open_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.record_cash_movement(uuid, public.cash_movement_kind, numeric, text) to authenticated;
grant execute on function public.record_expense(uuid, text, numeric, public.payment_method, uuid, text, text) to authenticated;
grant execute on function public.adjust_stock(uuid, uuid, numeric, public.stock_reason, text) to authenticated;
grant execute on function public.create_purchase_order(uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
grant execute on function public.verify_staff_pin(text) to authenticated;
grant execute on function public.set_staff_pin(uuid, text) to authenticated;
grant execute on function public.get_owner_dashboard_metrics(uuid, date, date) to authenticated;
