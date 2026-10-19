-- Karachi Express POS — Migration 000008: Fix SECURITY DEFINER permissions & advisor warnings
-- 1. Alters default privileges so newly created functions do NOT grant execute to PUBLIC or anon.
-- 2. Revokes execute from PUBLIC and anon on all transactional RPCs and helper functions (fixes lint 0028).
-- 3. Revokes execute on rls_auto_enable from all roles (fixes lint 0028 & 0029).
-- 4. Re-grants execute strictly to authenticated users for authorized operational RPCs.

-- ---------------------------------------------------------------- default privileges
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------- revoke from public and anon
revoke execute on function public.create_order(uuid, uuid, public.order_type, uuid, text, text, text, text, numeric, numeric, jsonb) from public, anon;
revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.settle_payment(uuid, uuid, public.payment_method, numeric, uuid, uuid, text) from public, anon;
revoke execute on function public.open_cash_session(uuid, numeric, text) from public, anon;
revoke execute on function public.close_cash_session(uuid, numeric, text) from public, anon;
revoke execute on function public.record_cash_movement(uuid, public.cash_movement_kind, numeric, text) from public, anon;
revoke execute on function public.record_expense(uuid, text, numeric, public.payment_method, uuid, text, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, uuid, numeric, public.stock_reason, text) from public, anon;
revoke execute on function public.create_purchase_order(uuid, uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.receive_purchase_order(uuid) from public, anon;
revoke execute on function public.verify_staff_pin(text) from public, anon;
revoke execute on function public.set_staff_pin(uuid, text) from public, anon;
revoke execute on function public.get_owner_dashboard_metrics(uuid, date, date) from public, anon;
revoke execute on function public.seed_demo_restaurant() from public, anon;

-- Helper functions
revoke execute on function public.current_branch_id() from public, anon;
revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.has_branch_access(uuid) from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;

-- ---------------------------------------------------------------- rls_auto_enable
-- Internal trigger/utility: revoke from public, anon, and authenticated
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated;';
  end if;
end $$;

-- ---------------------------------------------------------------- re-grant to authenticated
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
grant execute on function public.seed_demo_restaurant() to authenticated;
