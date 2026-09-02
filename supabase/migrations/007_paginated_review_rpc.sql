create index if not exists review_issues_status_created_idx
  on public.review_issues(status, created_at desc, id desc);

create or replace function public.get_review_issues_page(
  p_status text default 'open',
  p_category text default 'all',
  p_language text default null,
  p_part integer default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  issue_id bigint,
  issue_type text,
  issue_detail text,
  issue_status text,
  issue_created_at timestamptz,
  voter_id uuid,
  part_number integer,
  serial_number text,
  voter_name text,
  relation_type text,
  relation_name text,
  house_number text,
  age integer,
  gender text,
  epic_number text,
  source_language text,
  verification_status public.verification_status,
  voter_ocr_confidence real,
  voter_pdf_page_number integer,
  voter_printed_page_number integer,
  original_text text,
  field_confidence jsonb,
  corrected_value jsonb,
  pdf_id uuid,
  filename text,
  storage_path text,
  page_id bigint,
  page_status text,
  page_ocr_confidence real,
  page_pdf_page_number integer,
  page_printed_page_number integer,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      i.id as issue_id,
      i.issue_type,
      i.issue_detail,
      i.status as issue_status,
      i.created_at as issue_created_at,
      v.id as voter_id,
      coalesce(v.part_number, d.part_number) as part_number,
      v.serial_number,
      v.original_name as voter_name,
      v.relation_type,
      v.original_relation_name as relation_name,
      v.original_house_number as house_number,
      v.age,
      v.gender,
      v.epic_number,
      coalesce(v.original_language, d.source_language) as source_language,
      v.verification_status,
      v.ocr_confidence as voter_ocr_confidence,
      v.pdf_page_number as voter_pdf_page_number,
      v.printed_page_number as voter_printed_page_number,
      v.original_text,
      v.field_confidence,
      v.corrected_value,
      d.id as pdf_id,
      d.filename,
      d.storage_path,
      p.id as page_id,
      p.status as page_status,
      p.ocr_confidence as page_ocr_confidence,
      p.pdf_page_number as page_pdf_page_number,
      p.printed_page_number as page_printed_page_number
    from public.review_issues i
    join public.uploaded_pdfs d on d.id = i.pdf_id
    left join public.voter_records v on v.id = i.voter_id
    left join public.page_processing p on p.id = i.page_id
    where
      (coalesce(p_status, 'open') = 'all' or i.status = coalesce(p_status, 'open'))
      and (p_part is null or coalesce(v.part_number, d.part_number) = p_part)
      and (
        p_language is null
        or p_language = 'all'
        or coalesce(v.original_language, d.source_language) = p_language
      )
      and case coalesce(p_category, 'all')
        when 'critical' then i.issue_type in (
          'page_failure', 'missing_page', 'malformed_record',
          'page_sequence', 'possible_duplicate'
        )
        when 'pages' then i.voter_id is null or i.issue_type in (
          'page_failure', 'missing_page', 'malformed_record', 'page_sequence'
        )
        when 'records' then i.voter_id is not null
        when 'low_confidence' then i.issue_type = 'low_confidence'
        when 'serial_gaps' then i.issue_type = 'serial_gap'
        when 'house_number' then i.voter_id is not null and (
          v.original_house_number is null
          or btrim(v.original_house_number) = ''
          or char_length(v.original_house_number) > 40
          or v.original_house_number !~ '[0-9]'
          or v.original_house_number ~* '(photo|not available|elector|gender|age)'
          or (v.house_confidence is not null and v.house_confidence < 95)
        )
        when 'possible_duplicate' then i.issue_type = 'possible_duplicate'
        when 'language' then i.issue_type = 'language'
        else true
      end
  ),
  counted as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
  )
  select *
  from counted
  order by issue_created_at desc, issue_id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.get_review_issues_page(text, text, text, integer, integer, integer) is
  'Returns one filtered, paginated and fully enriched admin review queue page without browser-side UUID IN lists.';

revoke all on function public.get_review_issues_page(text, text, text, integer, integer, integer)
  from public, anon;
grant execute on function public.get_review_issues_page(text, text, text, integer, integer, integer)
  to authenticated;
