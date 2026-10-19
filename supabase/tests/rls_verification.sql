-- RLS + invariant verification. Runs entirely inside one DO block and ALWAYS
-- rolls back by raising at the end; nothing persists in the database.
do $$
declare
  ba uuid := gen_random_uuid(); bb uuid := gen_random_uuid();
  u_owner uuid := gen_random_uuid(); u_cash uuid := gen_random_uuid();
  u_kit uuid := gen_random_uuid(); u_mgrb uuid := gen_random_uuid();
  t_a uuid; o_a uuid; cs uuid; inv uuid; cat_a uuid;
  n int; res text := ''; fails int := 0; passes int := 0;
  ok boolean;
begin
  -- ---------- fixtures (as postgres) ----------
  insert into auth.users (id, email, aud, role) values
    (u_owner, 'owner@t.test', 'authenticated', 'authenticated'),
    (u_cash, 'cash@t.test', 'authenticated', 'authenticated'),
    (u_kit, 'kit@t.test', 'authenticated', 'authenticated'),
    (u_mgrb, 'mgrb@t.test', 'authenticated', 'authenticated');
  insert into branches (id, name) values (ba, 'T-Branch A'), (bb, 'T-Branch B');
  insert into profiles (id, branch_id, role, full_name) values
    (u_owner, null, 'owner', 'O'), (u_cash, ba, 'cashier', 'C'),
    (u_kit, ba, 'kitchen', 'K'), (u_mgrb, bb, 'manager', 'M');
  insert into menu_categories (branch_id, name) values (ba, 'Mains') returning id into cat_a;
  insert into dining_tables (branch_id, label) values (ba, 'T1') returning id into t_a;
  insert into orders (branch_id, order_number, client_request_id, type, table_id, created_by, subtotal, total)
    values (ba, 1, gen_random_uuid(), 'dine_in', t_a, u_cash, 1000, 1000) returning id into o_a;
  insert into cash_sessions (branch_id, opened_by, opening_float) values (ba, u_cash, 5000) returning id into cs;
  insert into payments (branch_id, order_id, method, status, amount, cash_session_id, idempotency_key)
    values (ba, o_a, 'cash', 'succeeded', 1000, cs, gen_random_uuid());
  insert into inventory_items (branch_id, name, unit) values (ba, 'Rice', 'kg') returning id into inv;
  insert into stock_movements (branch_id, inventory_item_id, delta, reason) values (ba, inv, 10, 'opening');

  -- ---------- invariants (as postgres) ----------
  select current_qty into n from inventory_items where id = inv;
  if n = 10 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:stock_trigger'; end if;

  begin insert into stock_movements (branch_id, inventory_item_id, delta, reason) values (ba, inv, -11, 'sale');
    fails := fails + 1; res := res || ' FAIL:negative_stock_allowed';
  exception when check_violation then passes := passes + 1; end;

  begin update stock_movements set delta = 99 where inventory_item_id = inv;
    fails := fails + 1; res := res || ' FAIL:ledger_mutable';
  exception when raise_exception then passes := passes + 1; end;

  begin insert into orders (branch_id, order_number, client_request_id, type, created_by)
      select branch_id, 2, client_request_id, 'takeaway', created_by from orders where id = o_a;
    fails := fails + 1; res := res || ' FAIL:duplicate_order_allowed';
  exception when unique_violation then passes := passes + 1; end;

  begin insert into cash_sessions (branch_id, opened_by, opening_float) values (ba, u_cash, 0);
    fails := fails + 1; res := res || ' FAIL:two_open_sessions';
  exception when unique_violation then passes := passes + 1; end;

  begin insert into payments (branch_id, order_id, method, amount, idempotency_key)
      values (ba, o_a, 'cash', 10, gen_random_uuid());
    fails := fails + 1; res := res || ' FAIL:cash_without_session';
  exception when check_violation then passes := passes + 1; end;

  begin insert into profiles (id, branch_id, role, full_name) values (u_owner, null, 'owner', 'X');
    fails := fails + 1; res := res || ' FAIL:dup_profile';
  exception when unique_violation then passes := passes + 1; end;

  -- ---------- cashier, branch A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_cash, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from branches where name like 'T-Branch%';
  if n = 1 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cashier_branches=' || n; end if;
  select count(*) into n from orders where id = o_a;
  if n = 1 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cashier_sees_order'; end if;
  select count(*) into n from payments where order_id = o_a;
  if n = 1 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cashier_sees_payment'; end if;
  begin insert into orders (branch_id, order_number, client_request_id, type, created_by)
      values (ba, 9, gen_random_uuid(), 'takeaway', u_cash);
    fails := fails + 1; res := res || ' FAIL:cashier_direct_order_insert';
  exception when insufficient_privilege then passes := passes + 1; end;
  begin update profiles set role = 'owner' where id = u_cash;
    fails := fails + 1; res := res || ' FAIL:self_escalation';
  exception when insufficient_privilege then passes := passes + 1; end;
  begin insert into menu_categories (branch_id, name) values (ba, 'Hack');
    fails := fails + 1; res := res || ' FAIL:cashier_menu_write';
  exception when insufficient_privilege then passes := passes + 1; end;
  reset role;

  -- ---------- kitchen, branch A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_kit, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from payments;
  if n = 0 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:kitchen_sees_payments'; end if;
  select count(*) into n from cash_sessions;
  if n = 0 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:kitchen_sees_cash'; end if;
  select count(*) into n from orders where id = o_a;
  if n = 1 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:kitchen_cannot_see_order'; end if;
  reset role;

  -- ---------- manager, branch B ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgrb, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from orders where branch_id = ba;
  if n = 0 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cross_branch_orders'; end if;
  select count(*) into n from profiles where branch_id = ba;
  if n = 0 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cross_branch_profiles'; end if;
  select count(*) into n from inventory_items where branch_id = ba;
  if n = 0 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:cross_branch_inventory'; end if;
  begin insert into menu_categories (branch_id, name) values (bb, 'Own branch OK');
    passes := passes + 1;
  exception when others then fails := fails + 1; res := res || ' FAIL:mgr_own_branch_write:' || sqlerrm; end;
  begin insert into menu_categories (branch_id, name) values (ba, 'Other branch');
    fails := fails + 1; res := res || ' FAIL:mgr_cross_branch_write';
  exception when insufficient_privilege then passes := passes + 1; end;
  reset role;

  -- ---------- owner ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from branches where name like 'T-Branch%';
  if n = 2 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:owner_branches=' || n; end if;
  select count(*) into n from profiles where id in (u_cash, u_kit, u_mgrb);
  if n = 3 then passes := passes + 1; else fails := fails + 1; res := res || ' FAIL:owner_profiles=' || n; end if;
  begin insert into payments (branch_id, order_id, method, amount, idempotency_key)
      values (ba, o_a, 'card', 10, gen_random_uuid());
    fails := fails + 1; res := res || ' FAIL:owner_direct_payment_insert';
  exception when insufficient_privilege then passes := passes + 1; end;
  reset role;

  -- ---------- anon ----------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from branches;
    fails := fails + 1; res := res || ' FAIL:anon_reads_branches';
  exception when insufficient_privilege then passes := passes + 1; end;

  begin perform public.create_order(ba, gen_random_uuid(), 'dine_in', null, null, null, null, null, 0, 0, '[]'::jsonb);
    fails := fails + 1; res := res || ' FAIL:anon_calls_create_order';
  exception when insufficient_privilege then passes := passes + 1; end;
  reset role;

  raise exception 'RLS_TEST_RESULT passed=% failed=% %', passes, fails, res;
end $$;
