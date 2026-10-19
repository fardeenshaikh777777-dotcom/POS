-- Karachi Express POS — Realtime & Demo Seed (Phase 2)

-- ---------------------------------------------------------------- Enable Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.order_items;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.dining_tables;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.cash_sessions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.table_reservations;
  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------- seed_demo_restaurant
create or replace function public.seed_demo_restaurant()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_branch_id uuid;
  v_cat_biryani uuid;
  v_cat_karahi uuid;
  v_cat_bbq uuid;
  v_cat_naan uuid;
  v_cat_drinks uuid;
  v_item_cb uuid;
  v_item_bb uuid;
  v_item_mk uuid;
  v_item_tikka uuid;
  v_item_seekh uuid;
  v_item_naan uuid;
  v_item_chai uuid;
  v_item_mint uuid;
  v_inv_rice uuid;
  v_inv_chick uuid;
  v_inv_beef uuid;
  v_inv_mutton uuid;
  v_inv_oil uuid;
  v_inv_flour uuid;
  v_inv_milk uuid;
  v_sup_poultry uuid;
  v_sup_metro uuid;
  v_t1 uuid;
  v_t2 uuid;
begin
  -- 1. Create or get branch
  select id into v_branch_id from public.branches where name = 'Karachi Express (Clifton Main)' limit 1;
  if v_branch_id is null then
    v_branch_id := gen_random_uuid();
    insert into public.branches (
      id, name, city, address, phone, tax_rate, currency_symbol, receipt_header, receipt_footer
    ) values (
      v_branch_id,
      'Karachi Express (Clifton Main)',
      'Karachi',
      'Plot 12-C, Block 4, Clifton, Karachi',
      '021-35876543',
      13.00, -- Sindh sales tax on restaurants
      'Rs.',
      'Karachi Express — Authentic Pakistani Flavours',
      'Thank you for dining with us! For catering: 0300-1234567'
    );
  end if;

  -- Update caller's branch if currently null or not set
  if v_caller_id is not null then
    update public.profiles set branch_id = v_branch_id where id = v_caller_id and branch_id is null;
  end if;

  -- 2. Categories
  insert into public.menu_categories (branch_id, name, sort_order)
  values (v_branch_id, 'Biryani & Rice', 1)
  on conflict (branch_id, name) do update set sort_order = 1
  returning id into v_cat_biryani;

  insert into public.menu_categories (branch_id, name, sort_order)
  values (v_branch_id, 'Karahi & Handi', 2)
  on conflict (branch_id, name) do update set sort_order = 2
  returning id into v_cat_karahi;

  insert into public.menu_categories (branch_id, name, sort_order)
  values (v_branch_id, 'Charcoal BBQ', 3)
  on conflict (branch_id, name) do update set sort_order = 3
  returning id into v_cat_bbq;

  insert into public.menu_categories (branch_id, name, sort_order)
  values (v_branch_id, 'Tandoor & Breads', 4)
  on conflict (branch_id, name) do update set sort_order = 4
  returning id into v_cat_naan;

  insert into public.menu_categories (branch_id, name, sort_order)
  values (v_branch_id, 'Beverages & Desserts', 5)
  on conflict (branch_id, name) do update set sort_order = 5
  returning id into v_cat_drinks;

  -- 3. Menu items
  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_biryani, 'Chicken Biryani (Double Masala)', 'Aromatic basmati rice with succulent chicken piece, boiled aloo, and traditional spices.', 480.00, true)
  on conflict (branch_id, name) do update set price = 480.00, is_available = true returning id into v_item_cb;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_biryani, 'Beef Nalli Biryani', 'Slow cooked beef shank with rich marrow and aromatic spiced saffron rice.', 650.00, true)
  on conflict (branch_id, name) do update set price = 650.00, is_available = true returning id into v_item_bb;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_karahi, 'Mutton Shinwari Karahi (Full)', 'Tender mutton cooked in pure animal fat and tomatoes with green chillies and crushed black pepper.', 2600.00, true)
  on conflict (branch_id, name) do update set price = 2600.00, is_available = true returning id into v_item_mk;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_bbq, 'Chicken Tikka (Chest Piece)', 'Smoked on burning coals with secret red marinade, served with mint raita and sliced onions.', 380.00, true)
  on conflict (branch_id, name) do update set price = 380.00, is_available = true returning id into v_item_tikka;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_bbq, 'Beef Seekh Kabab (4 Pcs)', 'Melt in mouth minced beef skewers seasoned with roasted cumin, coriander, and brown onion.', 450.00, true)
  on conflict (branch_id, name) do update set price = 450.00, is_available = true returning id into v_item_seekh;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_naan, 'Garlic Roghani Naan', 'Clay oven baked fluffy bread brushed with desi butter, garlic and white sesame seeds.', 90.00, true)
  on conflict (branch_id, name) do update set price = 90.00, is_available = true returning id into v_item_naan;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_drinks, 'Karak Doodh Patti Chai', 'Slow-brewed strong tapal tea with buffalo milk and cardamom pods.', 120.00, true)
  on conflict (branch_id, name) do update set price = 120.00, is_available = true returning id into v_item_chai;

  insert into public.menu_items (branch_id, category_id, name, description, price, is_available)
  values (v_branch_id, v_cat_drinks, 'Fresh Mint Lemonade', 'Crushed ice with fresh garden mint leaves, lemon juice and black salt.', 180.00, true)
  on conflict (branch_id, name) do update set price = 180.00, is_available = true returning id into v_item_mint;

  -- 4. Dining tables
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 1 (Family)', 6) on conflict (branch_id, label) do nothing returning id into v_t1;
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 2', 4) on conflict (branch_id, label) do nothing returning id into v_t2;
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 3', 4) on conflict (branch_id, label) do nothing;
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 4 (Booth)', 4) on conflict (branch_id, label) do nothing;
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 5 (Corner)', 2) on conflict (branch_id, label) do nothing;
  insert into public.dining_tables (branch_id, label, seats) values (v_branch_id, 'Table 6 (Hall)', 8) on conflict (branch_id, label) do nothing;

  -- 5. Inventory Items
  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Super Kernel Basmati Rice', 'kg', 120.0, 25.0)
  on conflict (branch_id, name) do update set reorder_level = 25.0 returning id into v_inv_rice;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Fresh Farm Broiler Chicken', 'kg', 55.0, 15.0)
  on conflict (branch_id, name) do update set reorder_level = 15.0 returning id into v_inv_chick;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Prime Boneless Beef', 'kg', 40.0, 10.0)
  on conflict (branch_id, name) do update set reorder_level = 10.0 returning id into v_inv_beef;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Fresh Mutton Meat', 'kg', 30.0, 10.0)
  on conflict (branch_id, name) do update set reorder_level = 10.0 returning id into v_inv_mutton;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Cooking Oil (Canola/Soybean)', 'Ltr', 75.0, 20.0)
  on conflict (branch_id, name) do update set reorder_level = 20.0 returning id into v_inv_oil;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Fine Wheat Flour (Maida)', 'kg', 60.0, 15.0)
  on conflict (branch_id, name) do update set reorder_level = 15.0 returning id into v_inv_flour;

  insert into public.inventory_items (branch_id, name, unit, current_qty, reorder_level)
  values (v_branch_id, 'Buffalo Whole Milk', 'Ltr', 35.0, 10.0)
  on conflict (branch_id, name) do update set reorder_level = 10.0 returning id into v_inv_milk;

  -- 6. Recipes
  if v_item_cb is not null and v_inv_rice is not null then
    insert into public.recipe_items (branch_id, menu_item_id, inventory_item_id, quantity, unit)
    values (v_branch_id, v_item_cb, v_inv_rice, 0.250, 'kg')
    on conflict (menu_item_id, inventory_item_id) do nothing;

    insert into public.recipe_items (branch_id, menu_item_id, inventory_item_id, quantity, unit)
    values (v_branch_id, v_item_cb, v_inv_chick, 0.280, 'kg')
    on conflict (menu_item_id, inventory_item_id) do nothing;

    insert into public.recipe_items (branch_id, menu_item_id, inventory_item_id, quantity, unit)
    values (v_branch_id, v_item_cb, v_inv_oil, 0.040, 'Ltr')
    on conflict (menu_item_id, inventory_item_id) do nothing;
  end if;

  if v_item_naan is not null and v_inv_flour is not null then
    insert into public.recipe_items (branch_id, menu_item_id, inventory_item_id, quantity, unit)
    values (v_branch_id, v_item_naan, v_inv_flour, 0.120, 'kg')
    on conflict (menu_item_id, inventory_item_id) do nothing;
  end if;

  if v_item_chai is not null and v_inv_milk is not null then
    insert into public.recipe_items (branch_id, menu_item_id, inventory_item_id, quantity, unit)
    values (v_branch_id, v_item_chai, v_inv_milk, 0.150, 'Ltr')
    on conflict (menu_item_id, inventory_item_id) do nothing;
  end if;

  -- 7. Suppliers
  insert into public.suppliers (branch_id, name, contact_person, phone, email, address)
  values (v_branch_id, 'Clifton Poultry & Livestock', 'Haji Rafiq', '0300-9281721', 'cliftonpoultry@gmail.com', 'Korangi Meat Market, Karachi')
  on conflict (branch_id, name) do nothing returning id into v_sup_poultry;

  insert into public.suppliers (branch_id, name, contact_person, phone, email, address)
  values (v_branch_id, 'Metro Cash & Carry Hub', 'Tariq Mehmood', '0321-8822119', 'metro.khi@orders.pk', 'CAA / Stargate Flyover, Karachi')
  on conflict (branch_id, name) do nothing returning id into v_sup_metro;

  -- 8. Sample Customer
  insert into public.customers (branch_id, name, phone, address, total_orders, total_spent)
  values (v_branch_id, 'Hamza Siddiqui', '03332145678', 'House 45, Street 9, Phase 6 DHA, Karachi', 4, 3850.00)
  on conflict (branch_id, phone) do nothing;

  insert into public.customers (branch_id, name, phone, address, total_orders, total_spent)
  values (v_branch_id, 'Dr. Ayesha Malik', '03219876543', 'Apt 4B, Ocean Towers, Clifton, Karachi', 2, 2100.00)
  on conflict (branch_id, phone) do nothing;

  return jsonb_build_object(
    'branch_id', v_branch_id,
    'branch_name', 'Karachi Express (Clifton Main)',
    'status', 'ready'
  );
end $$;

grant execute on function public.seed_demo_restaurant() to authenticated;
