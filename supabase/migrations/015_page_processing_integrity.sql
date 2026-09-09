-- Enforce the physical-page and processing-run relationships for every write
-- path, including the Phase 3 worker RPC and legacy admin clients.

create or replace function public.validate_page_processing_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_pages integer;
begin
  select d.total_pdf_pages
  into v_total_pages
  from public.uploaded_pdfs d
  where d.id = new.pdf_id;

  if not found then
    raise exception 'The page source document does not exist.' using errcode = '23503';
  end if;
  if new.pdf_page_number < 1 or new.pdf_page_number > v_total_pages then
    raise exception 'The physical page number is outside the source PDF.'
      using errcode = '22023';
  end if;
  if new.processing_run_id is not null and not exists (
    select 1
    from public.processing_runs r
    where r.id = new.processing_run_id
      and r.document_id = new.pdf_id
  ) then
    raise exception 'The processing run does not belong to the page document.'
      using errcode = '23503';
  end if;
  if new.records_detected > 30
     or new.records_extracted > new.records_detected
     or new.review_records > new.records_extracted then
    raise exception 'The page extraction counts are inconsistent.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_page_processing_integrity()
from public, anon, authenticated;

drop trigger if exists validate_page_processing_integrity
on public.page_processing;

create trigger validate_page_processing_integrity
before insert or update of
  pdf_id,
  processing_run_id,
  pdf_page_number,
  records_detected,
  records_extracted,
  review_records
on public.page_processing
for each row execute function public.validate_page_processing_integrity();

