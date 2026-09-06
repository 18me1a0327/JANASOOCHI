-- Remove the remaining database-linter RLS initialization and duplicate-policy warnings.

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    and (select coalesce(auth.jwt() ->> 'is_anonymous', 'false')) <> 'true'
  );

drop policy if exists "admin manage part expectations" on public.part_expectations;
drop policy if exists "admin insert part expectations" on public.part_expectations;
drop policy if exists "admin update part expectations" on public.part_expectations;
drop policy if exists "admin delete part expectations" on public.part_expectations;

create policy "admin insert part expectations" on public.part_expectations
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "admin update part expectations" on public.part_expectations
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admin delete part expectations" on public.part_expectations
  for delete to authenticated
  using ((select public.is_admin()));
