-- Phase 4C: revision analytics and paginated EN/TE reconciliation evidence.

create index if not exists voter_records_active_reconciliation_idx
  on public.voter_records(logical_voter_id, original_language, created_at desc, id)
  where logical_voter_id is not null;

create or replace function public.get_revision_reconciliation_summary_v1(
  p_part integer default null
)
returns table (
  part_number integer,
  expected_slots bigint,
  active_documents bigint,
  revision_identifiers text[],
  source_records bigint,
  unlinked_source_records bigint,
  english_linked_slots bigint,
  telugu_linked_slots bigint,
  paired_slots bigint,
  reconciled_slots bigint,
  needs_review_slots bigint,
  missing_english_slots bigint,
  missing_telugu_slots bigint,
  duplicate_source_slots bigint,
  epic_conflict_slots bigint,
  verified_slots bigint
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
  if p_part is not null and p_part not in (227, 228, 229, 230) then
    raise exception 'Unsupported Part';
  end if;

  return query
  with source_scope as (
    select
      r.id,
      r.logical_voter_id,
      r.part_number,
      coalesce(r.original_language, d.source_language) as source_language,
      upper(nullif(btrim(coalesce(nullif(r.corrected_value ->> 'epic_number', ''), r.epic_number)), '')) as epic,
      nullif(lower(regexp_replace(btrim(coalesce(
        nullif(r.corrected_value ->> 'original_house_number', ''),
        r.normalized_house_number,
        r.original_house_number,
        ''
      )), '\s+', '', 'g')), '') as house_number,
      coalesce(
        case when (r.corrected_value ->> 'age') ~ '^[0-9]+$'
          then (r.corrected_value ->> 'age')::integer end,
        r.age
      ) as age,
      lower(nullif(btrim(coalesce(nullif(r.corrected_value ->> 'gender', ''), r.gender)), '')) as gender
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where coalesce(r.original_language, d.source_language) in ('en', 'te')
      and (p_part is null or r.part_number = p_part)
  ),
  source_counts as (
    select
      s.logical_voter_id,
      count(*) filter (where s.source_language = 'en')::bigint as en_count,
      count(*) filter (where s.source_language = 'te')::bigint as te_count
    from source_scope s
    where s.logical_voter_id is not null
    group by s.logical_voter_id
  ),
  source_ranked as (
    select
      s.*,
      row_number() over (
        partition by s.logical_voter_id, s.source_language
        order by s.id
      ) as source_rank
    from source_scope s
    where s.logical_voter_id is not null
  ),
  paired as (
    select
      l.id,
      l.part_number,
      l.verification_status,
      coalesce(c.en_count, 0)::bigint as en_count,
      coalesce(c.te_count, 0)::bigint as te_count,
      en.epic as en_epic,
      te.epic as te_epic,
      en.house_number as en_house,
      te.house_number as te_house,
      en.age as en_age,
      te.age as te_age,
      en.gender as en_gender,
      te.gender as te_gender
    from public.logical_voters l
    left join source_counts c on c.logical_voter_id = l.id
    left join source_ranked en
      on en.logical_voter_id = l.id and en.source_language = 'en' and en.source_rank = 1
    left join source_ranked te
      on te.logical_voter_id = l.id and te.source_language = 'te' and te.source_rank = 1
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
  ),
  evidence as (
    select
      p.*,
      case when p.en_epic is null or p.te_epic is null then 'unavailable'
        when p.en_epic = p.te_epic then 'match' else 'mismatch' end as epic_evidence,
      case when p.en_house is null or p.te_house is null then 'unavailable'
        when p.en_house = p.te_house then 'match' else 'mismatch' end as house_evidence,
      case when p.en_age is null or p.te_age is null then 'unavailable'
        when p.en_age = p.te_age then 'match' else 'mismatch' end as age_evidence,
      case when p.en_gender is null or p.te_gender is null then 'unavailable'
        when p.en_gender = p.te_gender then 'match' else 'mismatch' end as gender_evidence
    from paired p
  ),
  classified as (
    select
      e.*,
      case
        when e.en_count = 0 then 'missing_en'
        when e.te_count = 0 then 'missing_te'
        when e.en_count > 1 or e.te_count > 1 then 'duplicate_source'
        when e.epic_evidence = 'mismatch' then 'epic_conflict'
        when (
          (e.epic_evidence = 'mismatch')::integer +
          (e.house_evidence = 'mismatch')::integer +
          (e.age_evidence = 'mismatch')::integer +
          (e.gender_evidence = 'mismatch')::integer
        ) = 0 and (
          e.epic_evidence = 'match' or
          (e.house_evidence = 'match')::integer +
          (e.age_evidence = 'match')::integer +
          (e.gender_evidence = 'match')::integer >= 2
        ) then 'reconciled'
        else 'needs_review'
      end as reconciliation_status
    from evidence e
  ),
  document_stats as (
    select
      d.part_number,
      count(*)::bigint as active_documents,
      coalesce(
        array_agg(distinct nullif(btrim(d.revision_identifier), ''))
          filter (where nullif(btrim(d.revision_identifier), '') is not null),
        '{}'::text[]
      ) as revision_identifiers
    from public.uploaded_pdfs d
    where d.active_version = true
      and d.source_language in ('en', 'te')
      and (p_part is null or d.part_number = p_part)
    group by d.part_number
  ),
  source_stats as (
    select
      s.part_number,
      count(*)::bigint as source_records,
      count(*) filter (where s.logical_voter_id is null)::bigint as unlinked_source_records,
      count(distinct s.logical_voter_id) filter (
        where s.logical_voter_id is not null and s.source_language = 'en'
      )::bigint as english_linked_slots,
      count(distinct s.logical_voter_id) filter (
        where s.logical_voter_id is not null and s.source_language = 'te'
      )::bigint as telugu_linked_slots
    from source_scope s
    group by s.part_number
  )
  select
    e.part_number,
    e.expected_voter_total::bigint,
    coalesce(d.active_documents, 0)::bigint,
    coalesce(d.revision_identifiers, '{}'::text[]),
    coalesce(s.source_records, 0)::bigint,
    coalesce(s.unlinked_source_records, 0)::bigint,
    coalesce(s.english_linked_slots, 0)::bigint,
    coalesce(s.telugu_linked_slots, 0)::bigint,
    count(*) filter (where c.en_count > 0 and c.te_count > 0)::bigint,
    count(*) filter (where c.reconciliation_status = 'reconciled')::bigint,
    count(*) filter (where c.reconciliation_status = 'needs_review')::bigint,
    count(*) filter (where c.en_count = 0)::bigint,
    count(*) filter (where c.te_count = 0)::bigint,
    count(*) filter (where c.reconciliation_status = 'duplicate_source')::bigint,
    count(*) filter (where c.reconciliation_status = 'epic_conflict')::bigint,
    count(*) filter (where c.verification_status = 'verified')::bigint
  from public.part_expectations e
  left join classified c on c.part_number = e.part_number
  left join document_stats d on d.part_number = e.part_number
  left join source_stats s on s.part_number = e.part_number
  where p_part is null or e.part_number = p_part
  group by
    e.part_number, e.expected_voter_total, d.active_documents,
    d.revision_identifiers, s.source_records, s.unlinked_source_records,
    s.english_linked_slots, s.telugu_linked_slots
  order by e.part_number;
end;
$$;

create or replace function public.get_reconciliation_evidence_page_v1(
  p_part integer default null,
  p_status text default 'all',
  p_search text default null,
  p_limit integer default 25,
  p_after_part integer default null,
  p_after_serial integer default null,
  p_after_row_key text default null
)
returns table (
  row_key text,
  logical_voter_id uuid,
  part_number integer,
  serial_number text,
  logical_verification_status public.verification_status,
  reconciliation_status text,
  english_source_count bigint,
  telugu_source_count bigint,
  epic_evidence text,
  house_evidence text,
  age_evidence text,
  gender_evidence text,
  english_source_record_id uuid,
  english_document_id uuid,
  english_revision_identifier text,
  english_voter_name text,
  english_relation_name text,
  english_house_number text,
  english_age integer,
  english_gender text,
  english_epic text,
  english_physical_page integer,
  english_printed_page integer,
  english_bounding_box jsonb,
  telugu_source_record_id uuid,
  telugu_document_id uuid,
  telugu_revision_identifier text,
  telugu_voter_name text,
  telugu_relation_name text,
  telugu_house_number text,
  telugu_age integer,
  telugu_gender text,
  telugu_epic text,
  telugu_physical_page integer,
  telugu_printed_page integer,
  telugu_bounding_box jsonb,
  cursor_part integer,
  cursor_serial integer,
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
  if p_part is not null and p_part not in (227, 228, 229, 230) then
    raise exception 'Unsupported Part';
  end if;
  if coalesce(p_status, 'all') not in (
    'all', 'reconciled', 'needs_review', 'missing_en', 'missing_te',
    'duplicate_source', 'epic_conflict', 'unlinked_source'
  ) then
    raise exception 'Unsupported reconciliation status';
  end if;
  if (p_after_part is null or p_after_serial is null or p_after_row_key is null)
    and not (p_after_part is null and p_after_serial is null and p_after_row_key is null)
  then
    raise exception 'Reconciliation cursor is incomplete';
  end if;

  return query
  with source_scope as (
    select
      r.id,
      r.logical_voter_id,
      r.part_number,
      r.serial_number,
      r.verification_status,
      r.pdf_id as document_id,
      d.revision_identifier,
      coalesce(r.original_language, d.source_language) as source_language,
      coalesce(nullif(r.corrected_value ->> 'original_name', ''), r.original_name) as voter_name,
      coalesce(nullif(r.corrected_value ->> 'original_relation_name', ''), r.original_relation_name) as relation_name,
      coalesce(nullif(r.corrected_value ->> 'original_house_number', ''), r.original_house_number) as house_number,
      coalesce(
        case when (r.corrected_value ->> 'age') ~ '^[0-9]+$'
          then (r.corrected_value ->> 'age')::integer end,
        r.age
      ) as age,
      coalesce(nullif(r.corrected_value ->> 'gender', ''), r.gender) as gender,
      upper(nullif(btrim(coalesce(nullif(r.corrected_value ->> 'epic_number', ''), r.epic_number)), '')) as epic,
      nullif(lower(regexp_replace(btrim(coalesce(
        nullif(r.corrected_value ->> 'original_house_number', ''),
        r.normalized_house_number,
        r.original_house_number,
        ''
      )), '\s+', '', 'g')), '') as normalized_house,
      lower(nullif(btrim(coalesce(nullif(r.corrected_value ->> 'gender', ''), r.gender)), '')) as normalized_gender,
      r.pdf_page_number as physical_page,
      r.printed_page_number as printed_page,
      r.bounding_box,
      r.created_at
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where coalesce(r.original_language, d.source_language) in ('en', 'te')
      and (p_part is null or r.part_number = p_part)
  ),
  source_counts as (
    select
      s.logical_voter_id,
      count(*) filter (where s.source_language = 'en')::bigint as en_count,
      count(*) filter (where s.source_language = 'te')::bigint as te_count
    from source_scope s
    where s.logical_voter_id is not null
    group by s.logical_voter_id
  ),
  source_ranked as (
    select
      s.*,
      row_number() over (
        partition by s.logical_voter_id, s.source_language
        order by s.created_at desc, s.id
      ) as source_rank
    from source_scope s
    where s.logical_voter_id is not null
  ),
  paired as (
    select
      'logical:' || l.id::text as row_key,
      l.id as logical_voter_id,
      l.part_number,
      l.serial_number,
      case when l.serial_number ~ '^[0-9]+$' then l.serial_number::integer else 2147483647 end as serial_sort,
      l.verification_status as logical_verification_status,
      coalesce(c.en_count, 0)::bigint as en_count,
      coalesce(c.te_count, 0)::bigint as te_count,
      en.id as en_id, en.document_id as en_document_id,
      en.revision_identifier as en_revision_identifier,
      en.voter_name as en_name, en.relation_name as en_relation,
      en.house_number as en_house, en.normalized_house as en_normalized_house,
      en.age as en_age, en.gender as en_gender,
      en.normalized_gender as en_normalized_gender, en.epic as en_epic,
      en.physical_page as en_physical_page, en.printed_page as en_printed_page,
      en.bounding_box as en_bbox,
      te.id as te_id, te.document_id as te_document_id,
      te.revision_identifier as te_revision_identifier,
      te.voter_name as te_name, te.relation_name as te_relation,
      te.house_number as te_house, te.normalized_house as te_normalized_house,
      te.age as te_age, te.gender as te_gender,
      te.normalized_gender as te_normalized_gender, te.epic as te_epic,
      te.physical_page as te_physical_page, te.printed_page as te_printed_page,
      te.bounding_box as te_bbox
    from public.logical_voters l
    left join source_counts c on c.logical_voter_id = l.id
    left join source_ranked en
      on en.logical_voter_id = l.id and en.source_language = 'en' and en.source_rank = 1
    left join source_ranked te
      on te.logical_voter_id = l.id and te.source_language = 'te' and te.source_rank = 1
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
  ),
  evidence as (
    select
      p.*,
      case when p.en_epic is null or p.te_epic is null then 'unavailable'
        when p.en_epic = p.te_epic then 'match' else 'mismatch' end as epic_evidence,
      case when p.en_normalized_house is null or p.te_normalized_house is null then 'unavailable'
        when p.en_normalized_house = p.te_normalized_house then 'match' else 'mismatch' end as house_evidence,
      case when p.en_age is null or p.te_age is null then 'unavailable'
        when p.en_age = p.te_age then 'match' else 'mismatch' end as age_evidence,
      case when p.en_normalized_gender is null or p.te_normalized_gender is null then 'unavailable'
        when p.en_normalized_gender = p.te_normalized_gender then 'match' else 'mismatch' end as gender_evidence
    from paired p
  ),
  classified as (
    select
      e.*,
      case
        when e.en_count = 0 then 'missing_en'
        when e.te_count = 0 then 'missing_te'
        when e.en_count > 1 or e.te_count > 1 then 'duplicate_source'
        when e.epic_evidence = 'mismatch' then 'epic_conflict'
        when (
          (e.epic_evidence = 'mismatch')::integer +
          (e.house_evidence = 'mismatch')::integer +
          (e.age_evidence = 'mismatch')::integer +
          (e.gender_evidence = 'mismatch')::integer
        ) = 0 and (
          e.epic_evidence = 'match' or
          (e.house_evidence = 'match')::integer +
          (e.age_evidence = 'match')::integer +
          (e.gender_evidence = 'match')::integer >= 2
        ) then 'reconciled'
        else 'needs_review'
      end as reconciliation_status
    from evidence e
  ),
  unlinked as (
    select
      'source:' || s.id::text as row_key,
      null::uuid as logical_voter_id,
      s.part_number,
      s.serial_number,
      case when s.serial_number ~ '^[0-9]+$' then s.serial_number::integer else 2147483647 end as serial_sort,
      s.verification_status as logical_verification_status,
      'unlinked_source'::text as reconciliation_status,
      case when s.source_language = 'en' then 1 else 0 end::bigint as en_count,
      case when s.source_language = 'te' then 1 else 0 end::bigint as te_count,
      'unavailable'::text as epic_evidence,
      'unavailable'::text as house_evidence,
      'unavailable'::text as age_evidence,
      'unavailable'::text as gender_evidence,
      case when s.source_language = 'en' then s.id end as en_id,
      case when s.source_language = 'en' then s.document_id end as en_document_id,
      case when s.source_language = 'en' then s.revision_identifier end as en_revision_identifier,
      case when s.source_language = 'en' then s.voter_name end as en_name,
      case when s.source_language = 'en' then s.relation_name end as en_relation,
      case when s.source_language = 'en' then s.house_number end as en_house,
      case when s.source_language = 'en' then s.age end as en_age,
      case when s.source_language = 'en' then s.gender end as en_gender,
      case when s.source_language = 'en' then s.epic end as en_epic,
      case when s.source_language = 'en' then s.physical_page end as en_physical_page,
      case when s.source_language = 'en' then s.printed_page end as en_printed_page,
      case when s.source_language = 'en' then s.bounding_box end as en_bbox,
      case when s.source_language = 'te' then s.id end as te_id,
      case when s.source_language = 'te' then s.document_id end as te_document_id,
      case when s.source_language = 'te' then s.revision_identifier end as te_revision_identifier,
      case when s.source_language = 'te' then s.voter_name end as te_name,
      case when s.source_language = 'te' then s.relation_name end as te_relation,
      case when s.source_language = 'te' then s.house_number end as te_house,
      case when s.source_language = 'te' then s.age end as te_age,
      case when s.source_language = 'te' then s.gender end as te_gender,
      case when s.source_language = 'te' then s.epic end as te_epic,
      case when s.source_language = 'te' then s.physical_page end as te_physical_page,
      case when s.source_language = 'te' then s.printed_page end as te_printed_page,
      case when s.source_language = 'te' then s.bounding_box end as te_bbox
    from source_scope s
    where s.logical_voter_id is null
  ),
  combined as (
    select
      c.row_key, c.logical_voter_id, c.part_number, c.serial_number,
      c.serial_sort, c.logical_verification_status, c.reconciliation_status,
      c.en_count, c.te_count, c.epic_evidence, c.house_evidence,
      c.age_evidence, c.gender_evidence,
      c.en_id, c.en_document_id, c.en_revision_identifier, c.en_name,
      c.en_relation, c.en_house, c.en_age, c.en_gender, c.en_epic,
      c.en_physical_page, c.en_printed_page, c.en_bbox,
      c.te_id, c.te_document_id, c.te_revision_identifier, c.te_name,
      c.te_relation, c.te_house, c.te_age, c.te_gender, c.te_epic,
      c.te_physical_page, c.te_printed_page, c.te_bbox
    from classified c
    union all
    select * from unlinked
  ),
  filtered as (
    select c.*
    from combined c
    where (coalesce(p_status, 'all') = 'all' or c.reconciliation_status = p_status)
      and (
        nullif(btrim(p_search), '') is null
        or position(lower(btrim(p_search)) in lower(concat_ws(' ',
          c.part_number::text, c.serial_number,
          c.en_name, c.en_relation, c.en_house, c.en_epic,
          c.te_name, c.te_relation, c.te_house, c.te_epic
        ))) > 0
      )
  ),
  counted as (
    select f.*, count(*) over ()::bigint as result_total
    from filtered f
  )
  select
    c.row_key, c.logical_voter_id, c.part_number, c.serial_number,
    c.logical_verification_status, c.reconciliation_status,
    c.en_count, c.te_count,
    c.epic_evidence, c.house_evidence, c.age_evidence, c.gender_evidence,
    c.en_id, c.en_document_id, c.en_revision_identifier, c.en_name,
    c.en_relation, c.en_house, c.en_age, c.en_gender, c.en_epic,
    c.en_physical_page, c.en_printed_page, c.en_bbox,
    c.te_id, c.te_document_id, c.te_revision_identifier, c.te_name,
    c.te_relation, c.te_house, c.te_age, c.te_gender, c.te_epic,
    c.te_physical_page, c.te_printed_page, c.te_bbox,
    c.part_number, c.serial_sort, c.result_total
  from counted c
  where p_after_part is null
     or (c.part_number, c.serial_sort, c.row_key) >
        (p_after_part, p_after_serial, p_after_row_key)
  order by c.part_number, c.serial_sort, c.row_key
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

comment on function public.get_revision_reconciliation_summary_v1(integer) is
  'Admin-only current-revision EN/TE coverage and deterministic reconciliation aggregates. Source rows never increase logical-voter totals.';
comment on function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text) is
  'Admin-only keyset-paginated EN/TE source evidence. Names are displayed but never used as the primary cross-script identity rule.';

revoke all on function public.get_revision_reconciliation_summary_v1(integer)
  from public, anon, authenticated;
revoke all on function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.get_revision_reconciliation_summary_v1(integer)
  to authenticated;
grant execute on function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text)
  to authenticated;

