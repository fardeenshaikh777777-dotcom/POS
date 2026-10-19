-- Karachi Express POS — advisor hardening (forward-only fix for 000001/000002)
-- 1. Pin search_path on trigger functions (security lint 0011).
-- 2. One permissive SELECT policy per table (perf lint 0006): split "for all"
--    write policies into insert/update/delete and merge profile read policies.
-- 3. Evaluate auth.uid() once per statement via (select ...) (perf lint 0003).

alter function public.set_updated_at()       set search_path = public;
alter function public.apply_stock_movement() set search_path = public;
alter function public.forbid_mutation()      set search_path = public;

-- ---------------------------------------------------------------- profiles
drop policy profiles_select_self on public.profiles;
drop policy profiles_select_branch on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.has_role(array['owner','manager']::public.app_role[]))
        and ((select public.current_role_name()) = 'owner'
             or branch_id = (select public.current_branch_id())))
  );

-- ---------------------------------------------------------------- branches (owner write)
drop policy branches_owner_write on public.branches;
create policy branches_insert on public.branches for insert to authenticated
  with check ((select public.has_role(array['owner']::public.app_role[])));
create policy branches_update on public.branches for update to authenticated
  using ((select public.has_role(array['owner']::public.app_role[])))
  with check ((select public.has_role(array['owner']::public.app_role[])));
create policy branches_delete on public.branches for delete to authenticated
  using ((select public.has_role(array['owner']::public.app_role[])));

-- ---------------------------------------------------------------- config tables (manager/owner write)
do $$
declare t text;
begin
  foreach t in array array['menu_categories','menu_items','dining_tables','inventory_items'] loop
    execute format('drop policy %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (public.has_branch_access(branch_id)
                  and (select public.has_role(array['owner','manager']::public.app_role[])))$p$,
      t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (public.has_branch_access(branch_id)
             and (select public.has_role(array['owner','manager']::public.app_role[])))
      with check (public.has_branch_access(branch_id)
                  and (select public.has_role(array['owner','manager']::public.app_role[])))$p$,
      t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (public.has_branch_access(branch_id)
             and (select public.has_role(array['owner','manager']::public.app_role[])))$p$,
      t || '_delete', t);
  end loop;
end $$;
