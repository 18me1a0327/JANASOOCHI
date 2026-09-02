with suspicious as (
  select r.id
  from public.voter_records r
  where r.original_house_number is not null
    and (
      length(btrim(r.original_house_number)) > 40
      or r.original_house_number !~ '[0-9]'
      or r.original_house_number ~* '(photo|available|elector|voter|name|father|mother|husband|guardian|age|gender|epic|ఓటరు|పేరు|తండ్రి|తల్లి|భర్త|వయస్సు|లింగం|نام|والد|والدہ|شوہر|عمر|جنس)'
      or regexp_replace(btrim(r.original_house_number), '\s+', '', 'g') !~ '^[0-9]+([-/][0-9A-Za-z]+)*$'
    )
)
update public.voter_records r
set original_house_number = null,
    normalized_house_number = null,
    house_confidence = 0,
    field_confidence = jsonb_set(coalesce(r.field_confidence, '{}'::jsonb), '{house_number}', '0'::jsonb, true),
    verification_status = 'requires_review',
    updated_at = now()
from suspicious s
where r.id = s.id;

insert into public.review_issues(pdf_id, page_id, voter_id, issue_type, issue_detail)
select r.pdf_id, p.id, r.id, 'malformed_record', 'House number OCR is contaminated or requires verification'
from public.voter_records r
join public.page_processing p
  on p.pdf_id = r.pdf_id and p.pdf_page_number = r.pdf_page_number
where r.original_house_number is null
  and r.house_confidence = 0
  and not exists (
    select 1
    from public.review_issues i
    where i.voter_id = r.id
      and i.issue_type = 'malformed_record'
      and i.status = 'open'
  );
