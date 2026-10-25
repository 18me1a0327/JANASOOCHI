-- Statewide Part scope: queries, reconciliation and ingestion are keyed by
-- electoral_parts.id (AC + revision + Part number), never by Part number alone.

create or replace function public.electoral_part_in_scope(
  p_row_part_id uuid,
  p_part_id uuid,
  p_assembly_constituency_id uuid,
  p_parliamentary_constituency_id uuid,
  p_revision_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (
    p_part_id is null
    and p_assembly_constituency_id is null
    and p_parliamentary_constituency_id is null
    and p_revision_id is null
  ) or exists (
    select 1
    from public.electoral_parts ep
    join public.assembly_constituencies ac on ac.id = ep.assembly_constituency_id
    where ep.id = p_row_part_id
      and (p_part_id is null or ep.id = p_part_id)
      and (p_assembly_constituency_id is null or ep.assembly_constituency_id = p_assembly_constituency_id)
      and (p_parliamentary_constituency_id is null or ac.parliamentary_constituency_id = p_parliamentary_constituency_id)
      and (p_revision_id is null or ep.revision_id = p_revision_id)
  );
$$;

revoke all on function public.electoral_part_in_scope(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.electoral_part_in_scope(uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;

create or replace function public.inherit_voter_record_geography()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_part_id uuid;
  v_revision_id uuid;
begin
  select d.electoral_part_id, d.revision_id
  into v_part_id, v_revision_id
  from public.uploaded_pdfs d
  where d.id = new.pdf_id;

  if new.electoral_part_id is not null and v_part_id is not null
     and new.electoral_part_id <> v_part_id then
    raise exception 'A source record cannot belong to a different Part than its document.'
      using errcode = '22023';
  end if;

  new.electoral_part_id := coalesce(new.electoral_part_id, v_part_id);
  new.revision_id := coalesce(new.revision_id, v_revision_id);
  return new;
end;
$$;

revoke all on function public.inherit_voter_record_geography() from public, anon, authenticated;

drop trigger if exists voter_records_inherit_geography on public.voter_records;
create trigger voter_records_inherit_geography
before insert or update of pdf_id, electoral_part_id on public.voter_records
for each row execute function public.inherit_voter_record_geography();

update public.voter_records r
set electoral_part_id = d.electoral_part_id,
    revision_id = coalesce(r.revision_id, d.revision_id)
from public.uploaded_pdfs d
where d.id = r.pdf_id
  and r.electoral_part_id is null
  and d.electoral_part_id is not null;

create index if not exists voter_records_electoral_part_idx on public.voter_records (electoral_part_id);
create index if not exists logical_voters_electoral_part_idx on public.logical_voters (electoral_part_id);
create index if not exists uploaded_pdfs_electoral_part_idx on public.uploaded_pdfs (electoral_part_id);

create or replace function public.reconcile_logical_voters_for_electoral_part(p_electoral_part_id uuid)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_part integer;
  v_revision_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select ep.part_number, ep.revision_id
  into v_part, v_revision_id
  from public.electoral_parts ep
  where ep.id = p_electoral_part_id;
  if not found then
    raise exception 'Unknown electoral Part' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.part_expectations e
    where e.electoral_part_id = p_electoral_part_id
      and e.revision_id = v_revision_id
  ) then
    raise exception 'Part % has no verified serial expectations', v_part using errcode = '22023';
  end if;

  insert into public.logical_voters (
    part_number,
    electoral_part_id,
    revision_id,
    serial_number,
    lifecycle_status,
    expected_slot,
    quarantine_reason
  )
  select e.part_number, e.electoral_part_id, v_revision_id, serial_no::text, 'active', true, null
  from public.part_expectations e
  cross join lateral generate_series(
    e.expected_serial_start,
    e.expected_serial_end
  ) as serial_no
  where e.electoral_part_id = p_electoral_part_id
  on conflict (revision_id, electoral_part_id, serial_number) do update
  set lifecycle_status = 'active',
      expected_slot = true,
      quarantine_reason = null,
      updated_at = now();

  update public.logical_voters l
  set lifecycle_status = 'quarantined',
      expected_slot = false,
      canonical_source_record_id = null,
      quarantine_reason = case
        when l.serial_number is null then 'missing_serial'
        when btrim(l.serial_number) !~ '^[0-9]+$' then 'non_numeric_serial'
        else 'unexpected_or_noncanonical_serial'
      end,
      updated_at = now()
  where l.electoral_part_id = p_electoral_part_id
    and not exists (
      select 1
      from public.part_expectations e
      where e.electoral_part_id = l.electoral_part_id
        and l.serial_number ~ '^[0-9]{1,9}$'
        and l.serial_number =
          (case when l.serial_number ~ '^[0-9]{1,9}$'
            then l.serial_number::integer end)::text
        and (case when l.serial_number ~ '^[0-9]{1,9}$'
          then l.serial_number::integer end)
          between e.expected_serial_start and e.expected_serial_end
    );

  update public.voter_records r
  set logical_voter_id = l.id,
      updated_at = now()
  from public.logical_voters l,
       public.part_expectations e
  where r.electoral_part_id = p_electoral_part_id
    and e.electoral_part_id = r.electoral_part_id
    and l.electoral_part_id = r.electoral_part_id
    and l.expected_slot = true
    and l.lifecycle_status = 'active'
    and r.serial_number is not null
    and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
    and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)
      between e.expected_serial_start and e.expected_serial_end
    and l.serial_number =
      (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)::text
    and r.logical_voter_id is distinct from l.id;

  update public.voter_records r
  set logical_voter_id = null,
      updated_at = now()
  from public.logical_voters l,
       public.part_expectations e
  where r.electoral_part_id = p_electoral_part_id
    and l.id = r.logical_voter_id
    and l.expected_slot = true
    and e.electoral_part_id = r.electoral_part_id
    and (
      r.serial_number is null
      or btrim(r.serial_number) !~ '^[0-9]{1,9}$'
      or (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)
          not between e.expected_serial_start and e.expected_serial_end
      or l.electoral_part_id is distinct from r.electoral_part_id
      or l.serial_number is distinct from
        (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
          then btrim(r.serial_number)::integer end)::text
    );

  with candidates as (
    select
      (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)::text as canonical_serial,
      min(r.id::text)::uuid as source_record_id,
      count(*) as candidate_count
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id
     and d.active_version = true
     and d.source_language = 'en'
    join public.part_expectations e on e.electoral_part_id = r.electoral_part_id
    where r.electoral_part_id = p_electoral_part_id
      and r.serial_number is not null
      and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)
        between e.expected_serial_start and e.expected_serial_end
    group by (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)::text
  )
  update public.logical_voters l
  set canonical_source_record_id = case
        when c.candidate_count = 1 then c.source_record_id
        else null
      end,
      updated_at = now()
  from candidates c
  where l.electoral_part_id = p_electoral_part_id
    and l.serial_number = c.canonical_serial
    and l.expected_slot = true;

  update public.logical_voters l
  set canonical_source_record_id = null,
      updated_at = now()
  where l.electoral_part_id = p_electoral_part_id
    and l.expected_slot = true
    and not exists (
      select 1
      from public.voter_records r
      join public.uploaded_pdfs d
        on d.id = r.pdf_id
       and d.active_version = true
       and d.source_language = 'en'
      where r.electoral_part_id = p_electoral_part_id
        and r.serial_number is not null
        and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
          then btrim(r.serial_number)::integer end)::text = l.serial_number
    );

  if (
    select count(*)
    from public.logical_voters l
    where l.electoral_part_id = p_electoral_part_id
      and l.expected_slot = true
      and l.lifecycle_status = 'active'
  ) <> (
    select e.expected_voter_total
    from public.part_expectations e
    where e.electoral_part_id = p_electoral_part_id
  ) then
    raise exception 'Canonical registry invariant failed for Part %', v_part;
  end if;

  insert into public.audit_log (
    action,
    actor_id,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'logical_voters.reconciled',
    (select auth.uid()),
    'electoral_part',
    p_electoral_part_id::text,
    jsonb_build_object(
      'strategy', 'electoral_part_serial_expected_slots',
      'part_number', v_part,
      'revision_id', v_revision_id
    )
  );
end;
$function$;

revoke all on function public.reconcile_logical_voters_for_electoral_part(uuid) from public, anon;
grant execute on function public.reconcile_logical_voters_for_electoral_part(uuid) to authenticated, service_role;

create or replace function public.reconcile_logical_voters_for_part(p_part integer)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_part_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select array_agg(ep.id)
  into v_part_ids
  from public.electoral_parts ep
  where ep.part_number = p_part;

  if coalesce(cardinality(v_part_ids), 0) = 0 then
    raise exception 'Unsupported Part';
  end if;
  if cardinality(v_part_ids) > 1 then
    raise exception 'Part % exists in more than one constituency or revision; reconcile by electoral Part ID', p_part
      using errcode = '22023';
  end if;

  perform public.reconcile_logical_voters_for_electoral_part(v_part_ids[1]);
end;
$function$;

CREATE OR REPLACE FUNCTION public.persist_extracted_page_v1(p_document_id uuid, p_processing_run_id uuid, p_page jsonb, p_records jsonb, p_review_issues jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_document_part integer;
  v_document_electoral_part uuid;
  v_document_language text;
  v_started_by uuid;
  v_page_id bigint;
  v_page_number integer;
  v_record jsonb;
  v_issue jsonb;
  v_record_id uuid;
  v_row_count integer;
  v_inserted_records integer := 0;
  v_idempotent_records integer := 0;
  v_inserted_issues integer := 0;
  v_existing_matches boolean;
  v_is_service_role boolean :=
    coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role and not (select public.is_admin()) then
    raise exception 'Administrator authorization is required.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_page) <> 'object'
     or jsonb_typeof(p_records) <> 'array'
     or jsonb_typeof(p_review_issues) <> 'array' then
    raise exception 'Page, records and review issues use invalid JSON contracts.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_records) > 30
     or jsonb_array_length(p_review_issues) > 300 then
    raise exception 'The page persistence batch exceeds its safe size.'
      using errcode = '22023';
  end if;

  select d.part_number, d.source_language, d.electoral_part_id
  into v_document_part, v_document_language, v_document_electoral_part
  from public.uploaded_pdfs d
  where d.id = p_document_id;
  if not found then
    raise exception 'The source document does not exist.' using errcode = '23503';
  end if;
  if v_document_electoral_part is null
     or v_document_language not in ('en', 'te') then
    raise exception 'Only supported English and Telugu documents can be ingested.'
      using errcode = '22023';
  end if;

  select r.started_by
  into v_started_by
  from public.processing_runs r
  where r.id = p_processing_run_id
    and r.document_id = p_document_id;
  if not found then
    raise exception 'The processing run does not belong to the source document.'
      using errcode = '23503';
  end if;

  v_page_number := (p_page ->> 'pdf_page_number')::integer;
  if v_page_number < 1
     or (p_page ->> 'pdf_id')::uuid <> p_document_id
     or (p_page ->> 'processing_run_id')::uuid <> p_processing_run_id
     or (p_page ->> 'retry_count')::integer not between 0 and 2
     or (p_page ->> 'extraction_attempts')::integer not between 1 and 3
     or (p_page ->> 'records_extracted')::integer <> jsonb_array_length(p_records)
     or coalesce(p_page ->> 'status', '') not in (
       'processing', 'completed', 'completed_with_warnings',
       'requires_review', 'failed'
     ) then
    raise exception 'The page checkpoint failed validation.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_document_id::text || ':' || v_page_number::text, 0)
  );

  insert into public.page_processing (
    pdf_id,
    processing_run_id,
    pdf_page_number,
    printed_page_number,
    status,
    retry_count,
    extraction_attempts,
    records_detected,
    records_extracted,
    review_records,
    error_message,
    card_states,
    resumable,
    processed_at,
    updated_at
  ) values (
    p_document_id,
    p_processing_run_id,
    v_page_number,
    nullif(p_page ->> 'printed_page_number', '')::integer,
    p_page ->> 'status',
    (p_page ->> 'retry_count')::integer,
    (p_page ->> 'extraction_attempts')::integer,
    (p_page ->> 'records_detected')::integer,
    (p_page ->> 'records_extracted')::integer,
    (p_page ->> 'review_records')::integer,
    nullif(p_page ->> 'error_message', ''),
    coalesce(p_page -> 'card_states', '[]'::jsonb),
    true,
    now(),
    now()
  )
  on conflict (pdf_id, pdf_page_number) do update
  set processing_run_id = excluded.processing_run_id,
      printed_page_number = excluded.printed_page_number,
      status = excluded.status,
      retry_count = excluded.retry_count,
      extraction_attempts = excluded.extraction_attempts,
      records_detected = excluded.records_detected,
      records_extracted = excluded.records_extracted,
      review_records = excluded.review_records,
      error_message = excluded.error_message,
      card_states = excluded.card_states,
      resumable = excluded.resumable,
      processed_at = excluded.processed_at,
      updated_at = excluded.updated_at
  returning id into v_page_id;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    v_record_id := (v_record ->> 'id')::uuid;
    if (v_record ->> 'pdf_id')::uuid <> p_document_id
       or (v_record ->> 'part_number')::integer <> v_document_part
       or (v_record ->> 'pdf_page_number')::integer <> v_page_number
       or v_record ->> 'original_language' <> v_document_language
       or coalesce(v_record ->> 'verification_status', '') not in (
         'unverified', 'requires_review'
       )
       or v_record ? 'logical_voter_id'
       or v_record ? 'verified_by'
       or v_record ? 'verified_at'
       or (v_record ->> 'source_card_index')::integer not between 1 and 30 then
      raise exception 'A source record failed document/page safety validation.'
        using errcode = '22023';
    end if;

    if v_record ->> 'serial_number' is not null
       and not exists (
         select 1
         from public.part_expectations e
         where e.electoral_part_id = v_document_electoral_part
           and v_record ->> 'serial_number' ~ '^[0-9]+$'
           and (v_record ->> 'serial_number')::integer
             between e.expected_serial_start and e.expected_serial_end
       ) then
      raise exception 'A source record contains an invalid Part serial.'
        using errcode = '22023';
    end if;

    select exists (
      select 1
      from public.voter_records r
      where r.id = v_record_id
        and r.pdf_id = p_document_id
        and r.part_number = v_document_part
        and r.pdf_page_number = v_page_number
        and r.source_card_index = (v_record ->> 'source_card_index')::integer
        and r.serial_number is not distinct from (v_record ->> 'serial_number')
        and r.original_name is not distinct from (v_record ->> 'original_name')
        and r.original_relation_name is not distinct from (v_record ->> 'original_relation_name')
        and r.original_house_number is not distinct from (v_record ->> 'original_house_number')
        and r.original_text is not distinct from (v_record ->> 'original_text')
        and r.bounding_box is not distinct from coalesce(v_record -> 'bounding_box', 'null'::jsonb)
    ) into v_existing_matches;

    if v_existing_matches then
      v_idempotent_records := v_idempotent_records + 1;
      continue;
    end if;
    if exists (select 1 from public.voter_records r where r.id = v_record_id) then
      raise exception 'A retry attempted to overwrite preserved source evidence.'
        using errcode = '23505';
    end if;

    begin
      insert into public.voter_records (
        id,
        pdf_id,
        part_number,
        serial_number,
        original_name,
        normalized_name,
        relation_type,
        original_relation_name,
        normalized_relation_name,
        original_house_number,
        normalized_house_number,
        age,
        gender,
        epic_number,
        pdf_page_number,
        printed_page_number,
        original_text,
        original_language,
        ocr_confidence,
        bounding_box,
        verification_status,
        field_confidence,
        name_confidence,
        relation_confidence,
        house_confidence,
        age_confidence,
        epic_confidence,
        source_card_index,
        extraction_method,
        normalization_version,
        verification_evidence
      ) values (
        v_record_id,
        p_document_id,
        v_document_part,
        nullif(v_record ->> 'serial_number', ''),
        v_record ->> 'original_name',
        v_record ->> 'normalized_name',
        v_record ->> 'relation_type',
        v_record ->> 'original_relation_name',
        v_record ->> 'normalized_relation_name',
        v_record ->> 'original_house_number',
        v_record ->> 'normalized_house_number',
        nullif(v_record ->> 'age', '')::integer,
        v_record ->> 'gender',
        v_record ->> 'epic_number',
        v_page_number,
        nullif(v_record ->> 'printed_page_number', '')::integer,
        coalesce(v_record ->> 'original_text', ''),
        v_document_language,
        nullif(v_record ->> 'ocr_confidence', '')::real,
        v_record -> 'bounding_box',
        (v_record ->> 'verification_status')::public.verification_status,
        coalesce(v_record -> 'field_confidence', '{}'::jsonb),
        nullif(v_record ->> 'name_confidence', '')::real,
        nullif(v_record ->> 'relation_confidence', '')::real,
        nullif(v_record ->> 'house_confidence', '')::real,
        nullif(v_record ->> 'age_confidence', '')::real,
        nullif(v_record ->> 'epic_confidence', '')::real,
        (v_record ->> 'source_card_index')::smallint,
        v_record ->> 'extraction_method',
        v_record ->> 'normalization_version',
        coalesce(v_record -> 'verification_evidence', '{}'::jsonb)
      );
      v_inserted_records := v_inserted_records + 1;
    exception when unique_violation then
      raise exception 'A source card conflicts with an existing source record.'
        using errcode = '23505';
    end;
  end loop;

  for v_issue in select value from jsonb_array_elements(p_review_issues)
  loop
    if (v_issue ->> 'pdf_id')::uuid <> p_document_id
       or coalesce(v_issue ->> 'status', '') <> 'open'
       or not exists (
         select 1
         from public.voter_records r
         where r.id = (v_issue ->> 'voter_id')::uuid
           and r.pdf_id = p_document_id
           and r.pdf_page_number = v_page_number
       ) then
      raise exception 'A review issue failed page-record validation.'
        using errcode = '22023';
    end if;

    insert into public.review_issues (
      pdf_id,
      page_id,
      voter_id,
      issue_type,
      issue_detail,
      status,
      severity,
      original_values,
      resolution_metadata
    )
    select
      p_document_id,
      v_page_id,
      (v_issue ->> 'voter_id')::uuid,
      v_issue ->> 'issue_type',
      v_issue ->> 'issue_detail',
      'open',
      v_issue ->> 'severity',
      coalesce(v_issue -> 'original_values', '{}'::jsonb),
      coalesce(v_issue -> 'resolution_metadata', '{}'::jsonb)
    where not exists (
      select 1
      from public.review_issues existing
      where existing.voter_id = (v_issue ->> 'voter_id')::uuid
        and existing.issue_type = v_issue ->> 'issue_type'
        and existing.issue_detail = v_issue ->> 'issue_detail'
        and existing.status = 'open'
    );
    get diagnostics v_row_count = row_count;
    v_inserted_issues := v_inserted_issues + v_row_count;
  end loop;

  insert into public.audit_log (
    action,
    actor_id,
    entity_type,
    entity_id,
    metadata
  ) values (
    'page_ingestion_persisted',
    coalesce((select auth.uid()), v_started_by),
    'page_processing',
    v_page_id::text,
    jsonb_build_object(
      'document_id', p_document_id,
      'processing_run_id', p_processing_run_id,
      'pdf_page_number', v_page_number,
      'inserted_records', v_inserted_records,
      'idempotent_records', v_idempotent_records,
      'inserted_review_issues', v_inserted_issues
    )
  );

  return jsonb_build_object(
    'page_id', v_page_id,
    'inserted_records', v_inserted_records,
    'idempotent_records', v_idempotent_records,
    'inserted_review_issues', v_inserted_issues
  );
end;
$function$;

create or replace function public.import_verified_electoral_parts_v1(
  p_assembly_constituency_id uuid,
  p_revision_id uuid,
  p_source_reference text,
  p_parts jsonb
)
returns table (imported_part_id uuid, imported_part_number integer, import_action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ac_state uuid;
  v_revision_state uuid;
  v_item jsonb;
  v_part integer;
  v_total integer;
  v_start integer;
  v_end integer;
  v_part_id uuid;
  v_existed boolean;
  v_seen integer[] := '{}';
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_source_reference, '')), '') is null
     or length(p_source_reference) > 500 then
    raise exception 'A source reference to the official roll header is required.'
      using errcode = '22023';
  end if;

  select ac.state_id into v_ac_state
  from public.assembly_constituencies ac
  where ac.id = p_assembly_constituency_id;
  if not found then
    raise exception 'Unknown Assembly Constituency' using errcode = '22023';
  end if;

  select r.state_id into v_revision_state
  from public.electoral_revisions r
  where r.id = p_revision_id;
  if not found then
    raise exception 'Unknown electoral revision' using errcode = '22023';
  end if;
  if v_ac_state <> v_revision_state then
    raise exception 'The revision and Assembly Constituency belong to different states.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_parts) is distinct from 'array'
     or jsonb_array_length(p_parts) = 0
     or jsonb_array_length(p_parts) > 500 then
    raise exception 'Provide between 1 and 500 Parts per import.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_parts)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(v_item ->> 'part_number', '') !~ '^[0-9]{1,4}$'
       or coalesce(v_item ->> 'expected_voter_total', '') !~ '^[0-9]{1,5}$'
       or coalesce(v_item ->> 'expected_serial_start', '1') !~ '^[0-9]{1,5}$'
       or length(coalesce(v_item ->> 'polling_station_name', '')) > 300
       or length(coalesce(v_item ->> 'polling_station_address', '')) > 500 then
      raise exception 'Invalid Part row: %', left(v_item::text, 200) using errcode = '22023';
    end if;

    v_part := (v_item ->> 'part_number')::integer;
    v_total := (v_item ->> 'expected_voter_total')::integer;
    v_start := coalesce((v_item ->> 'expected_serial_start')::integer, 1);
    v_end := v_start + v_total - 1;

    if v_part < 1 or v_total < 1 or v_start < 1 then
      raise exception 'Part %, voter total and serial start must be positive.', v_part
        using errcode = '22023';
    end if;
    if nullif(v_item ->> 'expected_serial_end', '') is not null
       and (v_item ->> 'expected_serial_end') <> v_end::text then
      raise exception 'Part % serial range does not match its voter total.', v_part
        using errcode = '22023';
    end if;
    if v_part = any(v_seen) then
      raise exception 'Part % appears more than once in this import.', v_part
        using errcode = '22023';
    end if;
    v_seen := v_seen || v_part;

    select true into v_existed
    from public.electoral_parts ep
    where ep.assembly_constituency_id = p_assembly_constituency_id
      and ep.revision_id = p_revision_id
      and ep.part_number = v_part;
    v_existed := coalesce(v_existed, false);

    insert into public.electoral_parts (
      assembly_constituency_id, revision_id, part_number,
      polling_station_name, polling_station_address,
      expected_voter_total, geography_verification_status
    )
    values (
      p_assembly_constituency_id, p_revision_id, v_part,
      nullif(btrim(v_item ->> 'polling_station_name'), ''),
      nullif(btrim(v_item ->> 'polling_station_address'), ''),
      v_total, 'verified_from_source_header'
    )
    on conflict (assembly_constituency_id, revision_id, part_number) do update
    set polling_station_name = coalesce(excluded.polling_station_name, public.electoral_parts.polling_station_name),
        polling_station_address = coalesce(excluded.polling_station_address, public.electoral_parts.polling_station_address),
        expected_voter_total = excluded.expected_voter_total,
        geography_verification_status = 'verified_from_source_header'
    returning id into v_part_id;

    insert into public.part_expectations (
      part_number, expected_voter_total, expected_serial_start, expected_serial_end,
      updated_by, updated_at, electoral_part_id, revision_id
    )
    values (v_part, v_total, v_start, v_end, (select auth.uid()), now(), v_part_id, p_revision_id)
    on conflict (electoral_part_id, revision_id) do update
    set expected_voter_total = excluded.expected_voter_total,
        expected_serial_start = excluded.expected_serial_start,
        expected_serial_end = excluded.expected_serial_end,
        updated_by = excluded.updated_by,
        updated_at = now();

    if v_existed then v_updated := v_updated + 1; else v_inserted := v_inserted + 1; end if;
    imported_part_id := v_part_id;
    imported_part_number := v_part;
    import_action := case when v_existed then 'updated' else 'inserted' end;
    v_existed := null;
    return next;
  end loop;

  insert into public.audit_log (action, actor_id, entity_type, entity_id, metadata)
  values (
    'electoral_parts.imported',
    (select auth.uid()),
    'assembly_constituency',
    p_assembly_constituency_id::text,
    jsonb_build_object(
      'revision_id', p_revision_id,
      'source_reference', btrim(p_source_reference),
      'inserted', v_inserted,
      'updated', v_updated,
      'part_numbers', to_jsonb(v_seen)
    )
  );
end;
$$;

revoke all on function public.import_verified_electoral_parts_v1(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.import_verified_electoral_parts_v1(uuid, uuid, text, jsonb) to authenticated, service_role;

drop function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamp with time zone, bigint);
CREATE FUNCTION public.get_review_issues_page_v2(p_status text DEFAULT 'open'::text, p_severity text DEFAULT 'all'::text, p_category text DEFAULT 'all'::text, p_language text DEFAULT NULL::text, p_part integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_after_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id bigint DEFAULT NULL::bigint, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(issue_id bigint, issue_type text, issue_detail text, issue_status text, issue_severity text, issue_created_at timestamp with time zone, voter_id uuid, part_number integer, serial_number text, voter_name text, relation_type text, relation_name text, house_number text, age integer, gender text, epic_number text, source_language text, verification_status verification_status, voter_ocr_confidence real, voter_pdf_page_number integer, voter_printed_page_number integer, original_text text, field_confidence jsonb, corrected_value jsonb, pdf_id uuid, filename text, storage_path text, page_id bigint, page_status text, page_ocr_confidence real, page_pdf_page_number integer, page_printed_page_number integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
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
      and public.electoral_part_in_scope(coalesce(v.electoral_part_id, d.electoral_part_id), p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
$function$;
revoke all on function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamp with time zone, bigint, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_review_issues_page_v2(text, text, text, text, integer, text, integer, timestamp with time zone, bigint, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.get_data_quality_summary(integer, text);
CREATE FUNCTION public.get_data_quality_summary(p_part integer DEFAULT NULL::integer, p_language text DEFAULT NULL::text, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(expected_slots bigint, active_logical_voters bigint, extracted_source_records bigint, linked_source_records bigint, missing_serials bigint, duplicate_serial_groups bigint, unexpected_serials bigint, duplicate_epic_groups bigint, expected_voter_cards bigint, extracted_voter_cards bigint, failed_pages bigint, partial_pages bigint, null_name_records bigint, null_relation_records bigint, null_house_records bigint, null_age_records bigint, null_epic_records bigint, reconciliation_conflicts bigint, critical_issues bigint, needs_review_issues bigint, informational_issues bigint, verified_logical_voters bigint, unverified_logical_voters bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
    raise exception 'Unsupported Part';
  end if;
  if p_language is not null and p_language not in ('en', 'te', 'ur') then
    raise exception 'Unsupported language';
  end if;

  return query
  with expectations as (
    select e.*
    from public.part_expectations e
    where (p_part is null or e.part_number = p_part)
    and public.electoral_part_in_scope(e.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  logical_scope as (
    select l.*
    from public.logical_voters l
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  source_scope as (
    select r.*, d.source_language as document_language
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where (p_part is null or r.part_number = p_part)
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and (p_language is null or d.source_language = p_language)
  ),
  serial_scope as (
    select
      l.part_number,
      l.serial_number,
      l.canonical_source_record_id as source_id
    from logical_scope l
    where p_language is null
    union all
    select
      s.part_number,
      s.serial_number,
      s.id as source_id
    from source_scope s
    where p_language is not null
  ),
  serial_normalized as (
    select
      s.*,
      case
        when s.serial_number is not null
          and btrim(s.serial_number) ~ '^[0-9]+$'
        then btrim(s.serial_number)::integer
        else null
      end as serial_int
    from serial_scope s
  ),
  expected_serials as (
    select e.part_number, serial_no
    from expectations e
    cross join lateral generate_series(
      e.expected_serial_start,
      e.expected_serial_end
    ) serial_no
  ),
  serial_counts as (
    select part_number, serial_int, count(source_id)::bigint as occurrences
    from serial_normalized
    where serial_int is not null
    group by part_number, serial_int
  ),
  epic_groups as (
    select upper(btrim(s.epic_number)) as epic_key
    from source_scope s
    where s.epic_number is not null and btrim(s.epic_number) <> ''
    group by upper(btrim(s.epic_number))
    having count(distinct coalesce(
      s.logical_voter_id::text,
      'source:' || s.id::text
    )) > 1
  ),
  page_scope as (
    select p.*
    from public.page_processing p
    join public.uploaded_pdfs d
      on d.id = p.pdf_id and d.active_version = true
    where (p_part is null or d.part_number = p_part)
      and public.electoral_part_in_scope(d.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and (p_language is null or d.source_language = p_language)
  ),
  issue_scope as (
    select i.*
    from public.review_issues i
    join public.uploaded_pdfs d
      on d.id = i.pdf_id and d.active_version = true
    where i.status = 'open'
      and (p_part is null or d.part_number = p_part)
      and public.electoral_part_in_scope(d.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and (p_language is null or d.source_language = p_language)
  )
  select
    (select coalesce(sum(e.expected_voter_total), 0)::bigint from expectations e),
    (select count(*)::bigint from logical_scope),
    (select count(*)::bigint from source_scope),
    (select count(*)::bigint from source_scope s
      join public.logical_voters l on l.id = s.logical_voter_id
      where l.expected_slot = true and l.lifecycle_status = 'active'),
    (select count(*)::bigint
      from expected_serials e
      left join serial_counts c
        on c.part_number = e.part_number and c.serial_int = e.serial_no
      where coalesce(c.occurrences, 0) = 0),
    (select count(*)::bigint from serial_counts where occurrences > 1),
    (select count(*)::bigint
      from serial_normalized s
      join expectations e on e.part_number = s.part_number
      where s.serial_int is null
         or s.serial_int < e.expected_serial_start
         or s.serial_int > e.expected_serial_end),
    (select count(*)::bigint from epic_groups),
    (select coalesce(sum(p.records_detected), 0)::bigint from page_scope p),
    (select coalesce(sum(p.records_extracted), 0)::bigint from page_scope p),
    (select count(*)::bigint from page_scope p
      where p.status in ('failed', 'requires_review') or p.error_type is not null),
    (select count(*)::bigint from page_scope p
      where p.records_detected > p.records_extracted),
    (select count(*)::bigint from source_scope s
      where s.original_name is null or btrim(s.original_name) = ''),
    (select count(*)::bigint from source_scope s
      where s.original_relation_name is null or btrim(s.original_relation_name) = ''),
    (select count(*)::bigint from source_scope s
      where s.original_house_number is null or btrim(s.original_house_number) = ''),
    (select count(*)::bigint from source_scope s where s.age is null),
    (select count(*)::bigint from source_scope s
      where s.epic_number is null or btrim(s.epic_number) = ''),
    (select count(*)::bigint from source_scope s
      left join public.logical_voters l
        on l.id = s.logical_voter_id
       and l.expected_slot = true
       and l.lifecycle_status = 'active'
      where l.id is null),
    (select count(*)::bigint from issue_scope i where i.severity = 'critical'),
    (select count(*)::bigint from issue_scope i where i.severity = 'needs_review'),
    (select count(*)::bigint from issue_scope i where i.severity = 'informational'),
    (select count(*)::bigint from logical_scope l
      where l.verification_status = 'verified'),
    (select count(*)::bigint from logical_scope l
      where l.verification_status <> 'verified');
end;
$function$;
revoke all on function public.get_data_quality_summary(integer, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_data_quality_summary(integer, text, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.get_voter_insights_v1(integer, text, text);
CREATE FUNCTION public.get_voter_insights_v1(p_part integer DEFAULT NULL::integer, p_gender text DEFAULT NULL::text, p_age_group text DEFAULT NULL::text, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(expected_total bigint, available_total bigint, male_total bigint, female_total bigint, other_total bigint, unknown_gender_total bigint, valid_age_count bigint, missing_age_count bigint, invalid_age_count bigint, average_age numeric, median_age numeric, youngest_age integer, oldest_age integer, house_group_count bigint, single_house_groups bigint, two_house_groups bigint, three_four_house_groups bigint, five_six_house_groups bigint, seven_plus_house_groups bigint, largest_house_group bigint, average_voters_per_house numeric, verified_total bigint, needs_review_total bigint, unverified_total bigint, critical_issue_count bigint, duplicate_epic_groups bigint, missing_gender_count bigint, missing_house_count bigint, missing_epic_count bigint, missing_serial_count bigint, unexpected_serial_count bigint, duplicate_part_serial_groups bigint, parts jsonb, age_groups jsonb, house_groups jsonb, revision_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
    raise exception 'Unsupported Part';
  end if;
  if p_gender is not null and p_gender not in ('male', 'female', 'other_unknown') then
    raise exception 'Unsupported gender filter';
  end if;
  if p_age_group is not null and p_age_group not in (
    '18_25', '26_35', '36_45', '46_60', '61_75', '76_plus', 'unknown_invalid'
  ) then
    raise exception 'Unsupported age-group filter';
  end if;

  return query
  with expectations as (
    select e.part_number, e.expected_voter_total
    from public.part_expectations e
    where (p_part is null or e.part_number = p_part)
    and public.electoral_part_in_scope(e.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  canonical_base as (
    select
      l.id as logical_voter_id,
      l.part_number,
      l.serial_number,
      l.verification_status as logical_verification_status,
      r.id as source_record_id,
      r.verification_status as source_verification_status,
      coalesce(
        case when (r.corrected_value ->> 'age') ~ '^[0-9]+$'
          then (r.corrected_value ->> 'age')::integer end,
        r.age
      ) as effective_age,
      coalesce(nullif(btrim(r.corrected_value ->> 'gender'), ''), r.gender) as effective_gender,
      coalesce(
        nullif(btrim(r.corrected_value ->> 'original_house_number'), ''),
        nullif(btrim(r.normalized_house_number), ''),
        nullif(btrim(r.original_house_number), '')
      ) as effective_house,
      coalesce(nullif(btrim(r.corrected_value ->> 'epic_number'), ''), r.epic_number) as effective_epic
    from public.logical_voters l
    left join public.voter_records r on r.id = l.canonical_source_record_id
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  normalized as (
    select
      c.*,
      case
        when lower(btrim(coalesce(c.effective_gender, ''))) in (
          'm', 'male', 'man', 'పురుషుడు', 'పురుషులు'
        ) then 'male'
        when lower(btrim(coalesce(c.effective_gender, ''))) in (
          'f', 'female', 'woman', 'స్త్రీ', 'మహిళ'
        ) then 'female'
        when lower(btrim(coalesce(c.effective_gender, ''))) in (
          'other', 'third gender', 'transgender', 't', 'ఇతరులు', 'తృతీయ లింగం'
        ) then 'other'
        else 'unknown'
      end as gender_group,
      case when c.effective_age between 18 and 125 then c.effective_age end as valid_age,
      case
        when c.effective_age between 18 and 25 then '18_25'
        when c.effective_age between 26 and 35 then '26_35'
        when c.effective_age between 36 and 45 then '36_45'
        when c.effective_age between 46 and 60 then '46_60'
        when c.effective_age between 61 and 75 then '61_75'
        when c.effective_age between 76 and 125 then '76_plus'
        else 'unknown_invalid'
      end as age_group,
      nullif(lower(regexp_replace(btrim(coalesce(c.effective_house, '')), '\\s+', '', 'g')), '') as house_key,
      nullif(upper(regexp_replace(btrim(coalesce(c.effective_epic, '')), '\\s+', '', 'g')), '') as epic_key
    from canonical_base c
  ),
  filtered as (
    select n.*
    from normalized n
    where n.source_record_id is not null
      and (
        p_gender is null
        or n.gender_group = p_gender
        or (p_gender = 'other_unknown' and n.gender_group in ('other', 'unknown'))
      )
      and (p_age_group is null or n.age_group = p_age_group)
  ),
  filtered_ids as (
    select f.logical_voter_id from filtered f
  ),
  open_issue_logicals as (
    select distinct r.logical_voter_id
    from public.review_issues i
    join public.voter_records r on r.id = i.voter_id
    join filtered_ids f on f.logical_voter_id = r.logical_voter_id
    where i.status = 'open'
      and r.logical_voter_id is not null
  ),
  critical_issues as (
    select count(*)::bigint as issue_count
    from public.review_issues i
    join public.voter_records r on r.id = i.voter_id
    join filtered_ids f on f.logical_voter_id = r.logical_voter_id
    where i.status = 'open' and i.severity = 'critical'
  ),
  house_sizes as (
    select f.part_number, f.house_key, count(*)::bigint as voter_count
    from filtered f
    where f.house_key is not null
    group by f.part_number, f.house_key
  ),
  epic_duplicates as (
    select f.epic_key
    from filtered f
    where f.epic_key is not null
    group by f.epic_key
    having count(distinct f.logical_voter_id) > 1
  ),
  source_serials as (
    select
      r.part_number,
      d.source_language,
      r.serial_number,
      case when btrim(coalesce(r.serial_number, '')) ~ '^[0-9]+$'
        then btrim(r.serial_number)::integer end as serial_int
    from public.voter_records r
    join public.uploaded_pdfs d on d.id = r.pdf_id and d.active_version = true
    where d.source_language in ('en', 'te')
      and (p_part is null or r.part_number = p_part)
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  duplicate_serials as (
    select s.part_number, s.source_language, s.serial_int
    from source_serials s
    join public.part_expectations e on e.part_number = s.part_number
    where s.serial_int between e.expected_serial_start and e.expected_serial_end
    group by s.part_number, s.source_language, s.serial_int
    having count(*) > 1
  ),
  part_rows as (
    select
      e.part_number,
      e.expected_voter_total::bigint as expected,
      count(f.logical_voter_id)::bigint as available,
      count(*) filter (where f.gender_group = 'male')::bigint as male,
      count(*) filter (where f.gender_group = 'female')::bigint as female,
      count(*) filter (where f.gender_group in ('other', 'unknown'))::bigint as other_unknown,
      round(avg(f.valid_age)::numeric, 1) as average_age,
      min(f.valid_age)::integer as youngest_age,
      max(f.valid_age)::integer as oldest_age,
      count(distinct (f.part_number, f.house_key)) filter (where f.house_key is not null)::bigint as house_groups,
      count(*) filter (where f.logical_verification_status = 'verified')::bigint as verified,
      count(*) filter (
        where f.logical_verification_status <> 'verified'
          and (f.source_verification_status = 'requires_review' or oi.logical_voter_id is not null)
      )::bigint as needs_review
    from expectations e
    left join filtered f on f.part_number = e.part_number
    left join open_issue_logicals oi on oi.logical_voter_id = f.logical_voter_id
    group by e.part_number, e.expected_voter_total
  ),
  age_labels(sort_order, key, label) as (
    values
      (1, '18_25'::text, '18–25'::text),
      (2, '26_35', '26–35'),
      (3, '36_45', '36–45'),
      (4, '46_60', '46–60'),
      (5, '61_75', '61–75'),
      (6, '76_plus', '76+'),
      (7, 'unknown_invalid', 'Unknown / invalid')
  ),
  house_labels(sort_order, key, label) as (
    values
      (1, 'one'::text, '1 voter'::text),
      (2, 'two', '2 voters'),
      (3, 'three_four', '3–4 voters'),
      (4, 'five_six', '5–6 voters'),
      (5, 'seven_plus', '7+ voters')
  )
  select
    (select coalesce(sum(e.expected_voter_total), 0)::bigint from expectations e),
    (select count(*)::bigint from filtered),
    (select count(*)::bigint from filtered f where f.gender_group = 'male'),
    (select count(*)::bigint from filtered f where f.gender_group = 'female'),
    (select count(*)::bigint from filtered f where f.gender_group = 'other'),
    (select count(*)::bigint from filtered f where f.gender_group = 'unknown'),
    (select count(*)::bigint from filtered f where f.valid_age is not null),
    (select count(*)::bigint from filtered f where f.effective_age is null),
    (select count(*)::bigint from filtered f where f.effective_age is not null and f.valid_age is null),
    (select round(avg(f.valid_age)::numeric, 1) from filtered f),
    (select round((percentile_cont(0.5) within group (order by f.valid_age))::numeric, 1)
      from filtered f where f.valid_age is not null),
    (select min(f.valid_age)::integer from filtered f),
    (select max(f.valid_age)::integer from filtered f),
    (select count(*)::bigint from house_sizes),
    (select count(*)::bigint from house_sizes h where h.voter_count = 1),
    (select count(*)::bigint from house_sizes h where h.voter_count = 2),
    (select count(*)::bigint from house_sizes h where h.voter_count between 3 and 4),
    (select count(*)::bigint from house_sizes h where h.voter_count between 5 and 6),
    (select count(*)::bigint from house_sizes h where h.voter_count >= 7),
    (select coalesce(max(h.voter_count), 0)::bigint from house_sizes h),
    (select round(avg(h.voter_count)::numeric, 1) from house_sizes h),
    (select count(*)::bigint from filtered f where f.logical_verification_status = 'verified'),
    (select count(*)::bigint from filtered f
      left join open_issue_logicals oi on oi.logical_voter_id = f.logical_voter_id
      where f.logical_verification_status <> 'verified'
        and (f.source_verification_status = 'requires_review' or oi.logical_voter_id is not null)),
    (select count(*)::bigint from filtered f
      left join open_issue_logicals oi on oi.logical_voter_id = f.logical_voter_id
      where f.logical_verification_status <> 'verified'
        and f.source_verification_status is distinct from 'requires_review'
        and oi.logical_voter_id is null),
    (select c.issue_count from critical_issues c),
    (select count(*)::bigint from epic_duplicates),
    (select count(*)::bigint from filtered f where f.gender_group = 'unknown'),
    (select count(*)::bigint from filtered f where f.house_key is null),
    (select count(*)::bigint from filtered f where f.epic_key is null),
    (select count(*)::bigint from canonical_base c where c.source_record_id is null),
    (select count(*)::bigint
      from source_serials s
      join public.part_expectations e on e.part_number = s.part_number
      where s.serial_int is null
         or s.serial_int < e.expected_serial_start
         or s.serial_int > e.expected_serial_end),
    (select count(*)::bigint from duplicate_serials),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'part', p.part_number,
      'expected', p.expected,
      'available', p.available,
      'male', p.male,
      'female', p.female,
      'other_unknown', p.other_unknown,
      'average_age', p.average_age,
      'youngest_age', p.youngest_age,
      'oldest_age', p.oldest_age,
      'house_groups', p.house_groups,
      'verified', p.verified,
      'needs_review', p.needs_review
    ) order by p.part_number), '[]'::jsonb) from part_rows p),
    (select jsonb_agg(jsonb_build_object(
      'key', a.key,
      'label', a.label,
      'count', (select count(*) from filtered f where f.age_group = a.key)
    ) order by a.sort_order) from age_labels a),
    (select jsonb_agg(jsonb_build_object(
      'key', h.key,
      'label', h.label,
      'count', case h.key
        when 'one' then (select count(*) from house_sizes s where s.voter_count = 1)
        when 'two' then (select count(*) from house_sizes s where s.voter_count = 2)
        when 'three_four' then (select count(*) from house_sizes s where s.voter_count between 3 and 4)
        when 'five_six' then (select count(*) from house_sizes s where s.voter_count between 5 and 6)
        else (select count(*) from house_sizes s where s.voter_count >= 7)
      end
    ) order by h.sort_order) from house_labels h),
    1::bigint;
end;
$function$;
revoke all on function public.get_voter_insights_v1(integer, text, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_voter_insights_v1(integer, text, text, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.get_revision_reconciliation_summary_v1(integer);
CREATE FUNCTION public.get_revision_reconciliation_summary_v1(p_part integer DEFAULT NULL::integer, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(part_number integer, expected_slots bigint, active_documents bigint, revision_identifiers text[], source_records bigint, unlinked_source_records bigint, english_linked_slots bigint, telugu_linked_slots bigint, paired_slots bigint, reconciled_slots bigint, needs_review_slots bigint, missing_english_slots bigint, missing_telugu_slots bigint, duplicate_source_slots bigint, epic_conflict_slots bigint, verified_slots bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
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
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
      and public.electoral_part_in_scope(d.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
  where (p_part is null or e.part_number = p_part)
    and public.electoral_part_in_scope(e.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  group by
    e.part_number, e.expected_voter_total, d.active_documents,
    d.revision_identifiers, s.source_records, s.unlinked_source_records,
    s.english_linked_slots, s.telugu_linked_slots
  order by e.part_number;
end;
$function$;
revoke all on function public.get_revision_reconciliation_summary_v1(integer, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_revision_reconciliation_summary_v1(integer, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text);
CREATE FUNCTION public.get_reconciliation_evidence_page_v1(p_part integer DEFAULT NULL::integer, p_status text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_after_part integer DEFAULT NULL::integer, p_after_serial integer DEFAULT NULL::integer, p_after_row_key text DEFAULT NULL::text, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(row_key text, logical_voter_id uuid, part_number integer, serial_number text, logical_verification_status verification_status, reconciliation_status text, english_source_count bigint, telugu_source_count bigint, epic_evidence text, house_evidence text, age_evidence text, gender_evidence text, english_source_record_id uuid, english_document_id uuid, english_revision_identifier text, english_voter_name text, english_relation_name text, english_house_number text, english_age integer, english_gender text, english_epic text, english_physical_page integer, english_printed_page integer, english_bounding_box jsonb, telugu_source_record_id uuid, telugu_document_id uuid, telugu_revision_identifier text, telugu_voter_name text, telugu_relation_name text, telugu_house_number text, telugu_age integer, telugu_gender text, telugu_epic text, telugu_physical_page integer, telugu_printed_page integer, telugu_bounding_box jsonb, cursor_part integer, cursor_serial integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
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
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
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
$function$;
revoke all on function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_reconciliation_evidence_page_v1(integer, text, text, integer, integer, integer, text, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.voter_language_coverage(integer);
CREATE FUNCTION public.voter_language_coverage(p_part integer DEFAULT NULL::integer, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(source_language text, logical_total bigint, source_records bigint, linked_records bigint, unlinked_records bigint, unavailable_records bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with supported_languages(source_language, language_order) as (
    values ('en'::text, 1), ('te'::text, 2), ('ur'::text, 3)
  ),
  logical_count as (
    select count(*)::bigint as logical_total
    from public.logical_voters l
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  source_count as (
    select
      d.source_language,
      count(*)::bigint as source_records,
      count(distinct l.id)::bigint as linked_records,
      count(*) filter (where l.id is null)::bigint as unlinked_records
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    left join public.logical_voters l
      on l.id = r.logical_voter_id
     and l.expected_slot = true
     and l.lifecycle_status = 'active'
    where d.source_language in ('en', 'te', 'ur')
      and (p_part is null or r.part_number = p_part)
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
    group by d.source_language
  )
  select
    languages.source_language,
    totals.logical_total,
    coalesce(sources.source_records, 0)::bigint,
    coalesce(sources.linked_records, 0)::bigint,
    coalesce(sources.unlinked_records, 0)::bigint,
    greatest(
      totals.logical_total - coalesce(sources.linked_records, 0),
      0
    )::bigint
  from supported_languages languages
  cross join logical_count totals
  left join source_count sources using (source_language)
  order by languages.language_order;
$function$;
revoke all on function public.voter_language_coverage(integer, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.voter_language_coverage(integer, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.search_source_records_page(integer, text, text, text, text, text, integer, text, text, text, boolean, integer, integer);
CREATE FUNCTION public.search_source_records_page(p_part integer DEFAULT NULL::integer, p_language text DEFAULT 'en'::text, p_name text DEFAULT NULL::text, p_relation_name text DEFAULT NULL::text, p_relation_type text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_age integer DEFAULT NULL::integer, p_gender text DEFAULT NULL::text, p_epic text DEFAULT NULL::text, p_serial text DEFAULT NULL::text, p_fuzzy boolean DEFAULT true, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, logical_voter_id uuid, document_id uuid, part_number integer, serial_number text, voter_name text, relation_type text, relation_name text, house_number text, age integer, gender text, epic_number text, physical_page_number integer, printed_page_number integer, source_language text, verification_status verification_status, ocr_confidence real, bounding_box jsonb, match_score numeric, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if p_part is not null and not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
    raise exception 'Unsupported Part';
  end if;
  if p_language not in ('en', 'te', 'ur') then
    raise exception 'Unsupported language';
  end if;
  if p_relation_type is not null and p_relation_type not in (
    'Father', 'Mother', 'Husband', 'Guardian', 'Other', 'Unknown'
  ) then
    raise exception 'Unsupported relation type';
  end if;
  if p_age is not null and (p_age < 18 or p_age > 125) then
    raise exception 'Unsupported age';
  end if;

  return query
  with effective as (
    select
      r.id,
      r.logical_voter_id,
      r.pdf_id as document_id,
      r.part_number,
      r.serial_number,
      coalesce(nullif(r.corrected_value ->> 'original_name', ''), r.original_name) as voter_name,
      r.relation_type,
      coalesce(nullif(r.corrected_value ->> 'original_relation_name', ''), r.original_relation_name) as relation_name,
      coalesce(nullif(r.corrected_value ->> 'original_house_number', ''), r.original_house_number) as house_number,
      coalesce(
        case when (r.corrected_value ->> 'age') ~ '^[0-9]+$'
          then (r.corrected_value ->> 'age')::integer end,
        r.age
      ) as voter_age,
      coalesce(nullif(r.corrected_value ->> 'gender', ''), r.gender) as voter_gender,
      coalesce(nullif(r.corrected_value ->> 'epic_number', ''), r.epic_number) as voter_epic,
      r.pdf_page_number,
      r.printed_page_number,
      coalesce(r.original_language, d.source_language) as source_language,
      r.verification_status,
      r.ocr_confidence,
      r.bounding_box,
      lower(btrim(coalesce(
        nullif(r.corrected_value ->> 'original_name', ''),
        r.normalized_name,
        r.original_name,
        ''
      ))) as search_name,
      lower(btrim(coalesce(
        nullif(r.corrected_value ->> 'original_relation_name', ''),
        r.normalized_relation_name,
        r.original_relation_name,
        ''
      ))) as search_relation,
      lower(regexp_replace(btrim(coalesce(
        nullif(r.corrected_value ->> 'original_house_number', ''),
        r.normalized_house_number,
        r.original_house_number,
        ''
      )), '\\s+', '', 'g')) as search_house
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id
     and d.active_version = true
    where r.part_number is not null
      and (p_part is null or r.part_number = p_part)
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and coalesce(r.original_language, d.source_language) = p_language
  ),
  scored as (
    select
      e.*,
      case when nullif(btrim(p_name), '') is null then null
        when e.search_name = lower(btrim(p_name)) then 100::numeric
        when e.search_name like '%' || lower(btrim(p_name)) || '%' then 96::numeric
        else round((extensions.similarity(e.search_name, lower(btrim(p_name))) * 100)::numeric, 1)
      end as name_score,
      case when nullif(btrim(p_relation_name), '') is null then null
        when e.search_relation = lower(btrim(p_relation_name)) then 100::numeric
        when e.search_relation like '%' || lower(btrim(p_relation_name)) || '%' then 96::numeric
        else round((extensions.similarity(e.search_relation, lower(btrim(p_relation_name))) * 100)::numeric, 1)
      end as relation_score,
      case when nullif(btrim(p_house_number), '') is null then null
        when e.search_house = lower(regexp_replace(btrim(p_house_number), '\\s+', '', 'g')) then 100::numeric
        when e.search_house like '%' || lower(regexp_replace(btrim(p_house_number), '\\s+', '', 'g')) || '%' then 96::numeric
        else round((extensions.similarity(
          e.search_house,
          lower(regexp_replace(btrim(p_house_number), '\\s+', '', 'g'))
        ) * 100)::numeric, 1)
      end as house_score
    from effective e
    where
      (p_relation_type is null or e.relation_type = p_relation_type)
      and (p_age is null or e.voter_age = p_age)
      and (nullif(btrim(p_gender), '') is null or lower(btrim(e.voter_gender)) = lower(btrim(p_gender)))
      and (nullif(btrim(p_epic), '') is null or upper(btrim(e.voter_epic)) = upper(btrim(p_epic)))
      and (nullif(btrim(p_serial), '') is null or btrim(e.serial_number) = btrim(p_serial))
  ),
  filtered as (
    select
      s.*,
      case
        when s.name_score is null and s.relation_score is null and s.house_score is null then null::numeric
        else round((
          coalesce(s.name_score * 6, 0) +
          coalesce(s.relation_score * 6, 0) +
          coalesce(s.house_score * 8, 0)
        ) / nullif(
          (case when s.name_score is null then 0 else 6 end) +
          (case when s.relation_score is null then 0 else 6 end) +
          (case when s.house_score is null then 0 else 8 end),
          0
        ), 1)
      end as calculated_match_score
    from scored s
    where
      (nullif(btrim(p_name), '') is null or s.name_score >= case when p_fuzzy then 72 else 96 end)
      and (nullif(btrim(p_relation_name), '') is null or s.relation_score >= case when p_fuzzy then 72 else 96 end)
      and (nullif(btrim(p_house_number), '') is null or s.house_score >= case when p_fuzzy then 72 else 96 end)
  ),
  counted as (
    select f.*, count(*) over ()::bigint as result_total
    from filtered f
  )
  select
    c.id,
    c.logical_voter_id,
    c.document_id,
    c.part_number,
    c.serial_number,
    c.voter_name,
    c.relation_type,
    c.relation_name,
    c.house_number,
    c.voter_age,
    c.voter_gender,
    c.voter_epic,
    c.pdf_page_number,
    c.printed_page_number,
    c.source_language,
    c.verification_status,
    c.ocr_confidence,
    c.bounding_box,
    c.calculated_match_score,
    c.result_total
  from counted c
  order by c.calculated_match_score desc nulls last,
    c.part_number,
    case when c.serial_number ~ '^[0-9]+$' then c.serial_number::integer end nulls last,
    c.serial_number,
    c.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;
revoke all on function public.search_source_records_page(integer, text, text, text, text, text, integer, text, text, text, boolean, integer, integer, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.search_source_records_page(integer, text, text, text, text, text, integer, text, text, text, boolean, integer, integer, uuid, uuid, uuid, uuid) to authenticated, service_role;

drop function public.get_serial_completeness_page(integer, text, text, integer, text);
CREATE FUNCTION public.get_serial_completeness_page(p_part integer, p_language text DEFAULT NULL::text, p_status text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_after_cursor text DEFAULT NULL::text, p_electoral_part_id uuid DEFAULT NULL::uuid, p_assembly_constituency_id uuid DEFAULT NULL::uuid, p_parliamentary_constituency_id uuid DEFAULT NULL::uuid, p_revision_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(serial_number text, serial_status text, occurrence_count bigint, source_record_ids uuid[], page_cursor text, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_part is null or not exists (select 1 from public.electoral_parts ep where ep.part_number = p_part) then
    raise exception 'Unsupported Part';
  end if;
  if p_language is not null and p_language not in ('en', 'te', 'ur') then
    raise exception 'Unsupported language';
  end if;
  if coalesce(p_status, 'all') not in ('all', 'ok', 'missing', 'duplicate', 'unexpected') then
    raise exception 'Unsupported completeness status';
  end if;

  return query
  with expectation as (
    select *
    from public.part_expectations e
    where e.part_number = p_part
      and public.electoral_part_in_scope(e.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
  ),
  active_sources as (
    select r.id, r.serial_number
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where r.part_number = p_part
      and public.electoral_part_in_scope(r.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and p_language is not null
      and d.source_language = p_language
  ),
  canonical_sources as (
    select l.canonical_source_record_id as id, l.serial_number
    from public.logical_voters l
    where l.part_number = p_part
      and public.electoral_part_in_scope(l.electoral_part_id, p_electoral_part_id, p_assembly_constituency_id, p_parliamentary_constituency_id, p_revision_id)
      and l.expected_slot = true
      and l.lifecycle_status = 'active'
      and p_language is null
  ),
  scoped as (
    select * from active_sources
    union all
    select * from canonical_sources
  ),
  normalized as (
    select
      s.id,
      s.serial_number,
      case
        when s.serial_number is not null
          and btrim(s.serial_number) ~ '^[0-9]+$'
        then btrim(s.serial_number)::integer
        else null
      end as serial_int
    from scoped s
  ),
  expected_rows as (
    select
      serial_no::text as serial_number,
      case
        when count(n.id) = 0 then 'missing'
        when count(n.id) > 1 then 'duplicate'
        else 'ok'
      end as serial_status,
      count(n.id)::bigint as occurrence_count,
      coalesce(array_agg(n.id) filter (where n.id is not null), '{}'::uuid[]) as source_record_ids,
      '0:' || lpad(serial_no::text, 12, '0') as page_cursor
    from expectation e
    cross join lateral generate_series(
      e.expected_serial_start,
      e.expected_serial_end
    ) serial_no
    left join normalized n on n.serial_int = serial_no
    group by serial_no
  ),
  unexpected_rows as (
    select
      coalesce(nullif(btrim(n.serial_number), ''), '[missing]') as serial_number,
      'unexpected'::text as serial_status,
      count(*)::bigint as occurrence_count,
      coalesce(array_agg(n.id) filter (where n.id is not null), '{}'::uuid[]) as source_record_ids,
      '1:' || coalesce(nullif(btrim(n.serial_number), ''), '[missing]') as page_cursor
    from normalized n
    cross join expectation e
    where n.serial_int is null
       or n.serial_int < e.expected_serial_start
       or n.serial_int > e.expected_serial_end
    group by coalesce(nullif(btrim(n.serial_number), ''), '[missing]')
  ),
  combined as (
    select * from expected_rows
    union all
    select * from unexpected_rows
  ),
  filtered as (
    select *
    from combined c
    where (coalesce(p_status, 'all') = 'all' or c.serial_status = p_status)
      and (p_after_cursor is null or c.page_cursor > p_after_cursor)
  ),
  counted as (
    select f.*, count(*) over ()::bigint as total_count
    from filtered f
  )
  select
    c.serial_number,
    c.serial_status,
    c.occurrence_count,
    c.source_record_ids,
    c.page_cursor,
    c.total_count
  from counted c
  order by c.page_cursor
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$function$;
revoke all on function public.get_serial_completeness_page(integer, text, text, integer, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_serial_completeness_page(integer, text, text, integer, text, uuid, uuid, uuid, uuid) to authenticated, service_role;
