-- Phase 4B: stable, server-filtered Review search and atomic correction writes.

create index if not exists review_issues_status_severity_cursor_idx
  on public.review_issues(status, severity, created_at desc, id desc);

create or replace function public.get_review_issues_page_v2(
  p_status text default 'open',
  p_severity text default 'all',
  p_category text default 'all',
  p_language text default null,
  p_part integer default null,
  p_search text default null,
  p_limit integer default 50,
  p_after_created_at timestamptz default null,
  p_after_id bigint default null
)
returns table (
  issue_id bigint,
  issue_type text,
  issue_detail text,
  issue_status text,
  issue_severity text,
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if coalesce(p_status, 'open') not in ('all', 'open', 'resolved', 'dismissed') then
    raise exception 'Unsupported Review status';
  end if;
  if coalesce(p_severity, 'all') not in ('all', 'critical', 'needs_review', 'informational') then
    raise exception 'Unsupported Review severity';
  end if;
  if coalesce(p_category, 'all') not in (
    'all', 'critical', 'pages', 'records', 'low_confidence',
    'serial_gaps', 'house_number', 'possible_duplicate', 'language'
  ) then
    raise exception 'Unsupported Review category';
  end if;
  if p_part is not null and p_part not in (227, 228, 229, 230) then
    raise exception 'Unsupported Part';
  end if;
  if p_language is not null and p_language not in ('en', 'te', 'ur') then
    raise exception 'Unsupported language';
  end if;
  if (p_after_created_at is null) <> (p_after_id is null) then
    raise exception 'Review cursor is incomplete';
  end if;

  return query
  with filtered as (
    select
      i.id as issue_id,
      i.issue_type,
      i.issue_detail,
      i.status as issue_status,
      i.severity as issue_severity,
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
    join public.uploaded_pdfs d
      on d.id = i.pdf_id and d.active_version = true
    left join public.voter_records v on v.id = i.voter_id
    left join public.page_processing p on p.id = i.page_id
    where
      (coalesce(p_status, 'open') = 'all' or i.status = coalesce(p_status, 'open'))
      and (coalesce(p_severity, 'all') = 'all' or i.severity = p_severity)
      and (p_part is null or coalesce(v.part_number, d.part_number) = p_part)
      and (
        p_language is null
        or coalesce(v.original_language, d.source_language) = p_language
      )
      and case coalesce(p_category, 'all')
        when 'critical' then i.severity = 'critical'
        when 'pages' then i.voter_id is null or i.issue_type in (
          'page_failure', 'missing_page', 'malformed_record',
          'page_sequence', 'card_count_mismatch', 'partial_page'
        )
        when 'records' then i.voter_id is not null
        when 'low_confidence' then i.issue_type = 'low_confidence'
        when 'serial_gaps' then i.issue_type in ('serial_gap', 'missing_serial')
        when 'house_number' then i.voter_id is not null and (
          v.original_house_number is null
          or btrim(v.original_house_number) = ''
          or char_length(v.original_house_number) > 40
          or v.original_house_number !~ '[0-9]'
          or v.original_house_number ~* '(photo|not available|elector|gender|age)'
          or (v.house_confidence is not null and v.house_confidence < 95)
        )
        when 'possible_duplicate' then i.issue_type in ('possible_duplicate', 'duplicate_serial', 'duplicate_epic')
        when 'language' then i.issue_type in ('language', 'language_incomplete')
        else true
      end
      and (
        nullif(btrim(p_search), '') is null
        or position(
          lower(btrim(p_search)) in lower(concat_ws(' ',
            i.issue_type,
            i.issue_detail,
            coalesce(v.part_number, d.part_number)::text,
            v.serial_number,
            v.original_name,
            v.original_relation_name,
            v.original_house_number,
            v.epic_number,
            d.filename
          ))
        ) > 0
      )
  ),
  counted as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
  )
  select
    c.issue_id, c.issue_type, c.issue_detail, c.issue_status,
    c.issue_severity, c.issue_created_at, c.voter_id, c.part_number,
    c.serial_number, c.voter_name, c.relation_type, c.relation_name,
    c.house_number, c.age, c.gender, c.epic_number, c.source_language,
    c.verification_status, c.voter_ocr_confidence,
    c.voter_pdf_page_number, c.voter_printed_page_number,
    c.original_text, c.field_confidence, c.corrected_value, c.pdf_id,
    c.filename, c.storage_path, c.page_id, c.page_status,
    c.page_ocr_confidence, c.page_pdf_page_number,
    c.page_printed_page_number, c.total_count
  from counted c
  where p_after_created_at is null
     or (c.issue_created_at, c.issue_id) < (p_after_created_at, p_after_id)
  order by c.issue_created_at desc, c.issue_id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

comment on function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamptz, bigint) is
  'Returns one active-document, server-filtered, keyset-paginated and fully enriched admin Review page.';

revoke all on function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamptz, bigint)
  from public, anon, authenticated;
grant execute on function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamptz, bigint)
  to authenticated;

create or replace function public.save_review_correction_v1(
  p_issue_id bigint,
  p_corrected_value jsonb,
  p_mark_verified boolean default false,
  p_reason text default null
)
returns table (
  issue_id bigint,
  voter_id uuid,
  issue_status text,
  verification_status public.verification_status,
  corrected_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := now();
  v_issue public.review_issues%rowtype;
  v_voter public.voter_records%rowtype;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_corrected_value is null or jsonb_typeof(p_corrected_value) <> 'object' then
    raise exception 'Corrected values must be a JSON object';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A correction reason is required';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Correction reason is too long';
  end if;
  if exists (
    select 1
    from jsonb_each(p_corrected_value) e
    where e.key not in (
      'original_name', 'original_relation_name', 'original_house_number',
      'age', 'gender', 'epic_number'
    ) or jsonb_typeof(e.value) not in ('string', 'null')
  ) then
    raise exception 'Corrected values contain an unsupported field or value';
  end if;

  select i.* into v_issue
  from public.review_issues i
  where i.id = p_issue_id
  for update;
  if not found then
    raise exception 'Review issue was not found';
  end if;
  if v_issue.status <> 'open' then
    raise exception 'Only an open Review issue can be corrected';
  end if;
  if v_issue.voter_id is null then
    raise exception 'This page-level issue has no voter record to correct';
  end if;

  select v.* into v_voter
  from public.voter_records v
  where v.id = v_issue.voter_id
  for update;
  if not found then
    raise exception 'The source voter record was not found';
  end if;

  insert into public.ocr_corrections (
    voter_id, original_value, corrected_value, corrected_by, corrected_at,
    correction_reason, resolution_type, metadata
  ) values (
    v_voter.id,
    jsonb_build_object(
      'original_name', v_voter.original_name,
      'original_relation_name', v_voter.original_relation_name,
      'original_house_number', v_voter.original_house_number,
      'age', v_voter.age,
      'gender', v_voter.gender,
      'epic_number', v_voter.epic_number
    ),
    p_corrected_value,
    v_actor,
    v_now,
    btrim(p_reason),
    case when p_mark_verified then 'human_verified' else 'human_correction' end,
    jsonb_build_object('review_issue_id', p_issue_id)
  );

  update public.voter_records
  set corrected_value = p_corrected_value,
      corrected_by = v_actor,
      corrected_at = v_now,
      verification_status = case when p_mark_verified then 'verified'::public.verification_status else verification_status end,
      verified_by = case when p_mark_verified then v_actor else verified_by end,
      verified_at = case when p_mark_verified then v_now else verified_at end,
      updated_at = v_now
  where id = v_voter.id;

  update public.review_issues
  set status = case when p_mark_verified then 'resolved' else status end,
      resolved_by = case when p_mark_verified then v_actor else resolved_by end,
      resolved_at = case when p_mark_verified then v_now else resolved_at end,
      resolution_type = case when p_mark_verified then 'human_verified' else 'human_correction' end,
      resolution_reason = btrim(p_reason),
      original_values = jsonb_build_object(
        'original_name', v_voter.original_name,
        'original_relation_name', v_voter.original_relation_name,
        'original_house_number', v_voter.original_house_number,
        'age', v_voter.age,
        'gender', v_voter.gender,
        'epic_number', v_voter.epic_number
      ),
      resulting_values = p_corrected_value,
      updated_at = v_now
  where id = v_issue.id;

  insert into public.audit_log (
    action, actor_id, entity_type, entity_id, metadata, operation_status
  ) values (
    case when p_mark_verified then 'review_corrected_and_verified' else 'review_correction_saved' end,
    v_actor,
    'review_issue',
    p_issue_id::text,
    jsonb_build_object(
      'voter_id', v_voter.id,
      'part_number', v_voter.part_number,
      'pdf_page_number', v_voter.pdf_page_number,
      'resolution_reason', btrim(p_reason)
    ),
    'succeeded'
  );

  return query
  select
    v_issue.id,
    v_voter.id,
    case when p_mark_verified then 'resolved' else 'open' end,
    case when p_mark_verified then 'verified'::public.verification_status else v_voter.verification_status end,
    v_now;
end;
$$;

comment on function public.save_review_correction_v1(bigint, jsonb, boolean, text) is
  'Atomically preserves a correction, updates the source record, optionally resolves one Review issue, and writes an audit event.';

revoke all on function public.save_review_correction_v1(bigint, jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.save_review_correction_v1(bigint, jsonb, boolean, text)
  to authenticated;

