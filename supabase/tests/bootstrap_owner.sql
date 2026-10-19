do $$
declare
  v_bid uuid;
begin
  select id into v_bid from public.branches limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@karachiexpress.pk',
    crypt('Karachi123!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Tariq Khan (Owner)"}'::jsonb,
    now(),
    now()
  ) on conflict (id) do nothing;

  insert into public.profiles (id, branch_id, role, full_name, is_active)
  values (
    'a0000000-0000-0000-0000-000000000001',
    v_bid,
    'owner',
    'Tariq Khan (Owner)',
    true
  ) on conflict (id) do update set role = 'owner', full_name = 'Tariq Khan (Owner)';

  -- Also provision manager, cashier, kitchen, waiter
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@karachiexpress.pk', crypt('Karachi123!', gen_salt('bf', 10)), now(), '{"provider":"email"}'::jsonb, '{"full_name":"Bilal Ahmed (Manager)"}'::jsonb, now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (id, branch_id, role, full_name, is_active)
  values ('a0000000-0000-0000-0000-000000000002', v_bid, 'manager', 'Bilal Ahmed (Manager)', true)
  on conflict (id) do update set role = 'manager';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier@karachiexpress.pk', crypt('Karachi123!', gen_salt('bf', 10)), now(), '{"provider":"email"}'::jsonb, '{"full_name":"Zeeshan Ali (Cashier)"}'::jsonb, now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (id, branch_id, role, full_name, is_active)
  values ('a0000000-0000-0000-0000-000000000003', v_bid, 'cashier', 'Zeeshan Ali (Cashier)', true)
  on conflict (id) do update set role = 'cashier';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kitchen@karachiexpress.pk', crypt('Karachi123!', gen_salt('bf', 10)), now(), '{"provider":"email"}'::jsonb, '{"full_name":"Ustad Bashir (Head Chef)"}'::jsonb, now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (id, branch_id, role, full_name, is_active)
  values ('a0000000-0000-0000-0000-000000000004', v_bid, 'kitchen', 'Ustad Bashir (Head Chef)', true)
  on conflict (id) do update set role = 'kitchen';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'waiter@karachiexpress.pk', crypt('Karachi123!', gen_salt('bf', 10)), now(), '{"provider":"email"}'::jsonb, '{"full_name":"Danish Raza (Waiter)"}'::jsonb, now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (id, branch_id, role, full_name, is_active)
  values ('a0000000-0000-0000-0000-000000000005', v_bid, 'waiter', 'Danish Raza (Waiter)', true)
  on conflict (id) do update set role = 'waiter';

end $$;
