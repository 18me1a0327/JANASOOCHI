-- Anonymous Auth identities are not provisioned in profiles, so the primary-key
-- comparison alone safely limits profile reads to the caller while avoiding a
-- second auth.jwt() policy expression.

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
