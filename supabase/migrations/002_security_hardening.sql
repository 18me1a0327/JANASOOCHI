alter extension pg_trgm set schema extensions;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "admin documents" on public.uploaded_pdfs;
create policy "admin insert documents" on public.uploaded_pdfs
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin update documents" on public.uploaded_pdfs
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete documents" on public.uploaded_pdfs
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admin voters" on public.voter_records;
create policy "admin insert voters" on public.voter_records
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin update voters" on public.voter_records
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete voters" on public.voter_records
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admin pages" on public.page_processing;
create policy "admin insert pages" on public.page_processing
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin update pages" on public.page_processing
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete pages" on public.page_processing
  for delete to authenticated using ((select public.is_admin()));

create index if not exists uploaded_pdfs_uploaded_by_idx
  on public.uploaded_pdfs(uploaded_by);
create index if not exists voter_records_pdf_id_idx
  on public.voter_records(pdf_id);
create index if not exists voter_records_corrected_by_idx
  on public.voter_records(corrected_by);
create index if not exists page_processing_pdf_id_idx
  on public.page_processing(pdf_id);

grant usage on schema public to authenticated;
grant select on public.profiles, public.uploaded_pdfs,
  public.voter_records, public.page_processing to authenticated;
grant insert, update, delete on public.uploaded_pdfs,
  public.voter_records, public.page_processing to authenticated;
grant usage, select on sequence public.page_processing_id_seq to authenticated;
