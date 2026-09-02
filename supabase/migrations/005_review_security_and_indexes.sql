drop policy if exists "authenticated read review issues" on public.review_issues;
drop policy if exists "admin manage review issues" on public.review_issues;
drop policy if exists "authenticated read corrections" on public.ocr_corrections;

create policy "admin read review issues" on public.review_issues
  for select to authenticated using ((select public.is_admin()));
create policy "admin insert review issues" on public.review_issues
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin update review issues" on public.review_issues
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "admin delete review issues" on public.review_issues
  for delete to authenticated using ((select public.is_admin()));

create policy "admin read corrections" on public.ocr_corrections
  for select to authenticated using ((select public.is_admin()));

create index if not exists audit_log_actor_idx on public.audit_log(actor_id);
create index if not exists ocr_corrections_corrected_by_idx on public.ocr_corrections(corrected_by);
create index if not exists review_issues_page_idx on public.review_issues(page_id);
create index if not exists review_issues_pdf_idx on public.review_issues(pdf_id);
create index if not exists review_issues_resolved_by_idx on public.review_issues(resolved_by);
create index if not exists review_issues_voter_idx on public.review_issues(voter_id);
create index if not exists uploaded_pdfs_supersedes_idx on public.uploaded_pdfs(supersedes_id);
create index if not exists voter_records_duplicate_of_idx on public.voter_records(duplicate_of);
