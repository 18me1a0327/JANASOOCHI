alter table public.page_processing
  add column if not exists ocr_confidence real
    check (ocr_confidence between 0 and 100),
  add column if not exists records_detected integer not null default 0
    check (records_detected >= 0),
  add column if not exists records_extracted integer not null default 0
    check (records_extracted >= 0),
  add column if not exists issue_detail text;

drop policy if exists "admin delete pdf" on storage.objects;
create policy "admin delete pdf"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'voter-pdfs'
    and (select public.is_admin())
  );

comment on column public.page_processing.ocr_confidence is
  'Page-level OCR confidence. NULL means embedded PDF text or an unprocessed page.';
comment on column public.page_processing.records_detected is
  'Number of voter-card labels detected on the physical PDF page.';
comment on column public.page_processing.records_extracted is
  'Number of voter records successfully parsed from the physical PDF page.';
