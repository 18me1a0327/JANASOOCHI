-- Phase 3B: transactionally persist one extracted page without overwriting
-- source evidence or silently duplicating voter records on retries.

create or replace function public.persist_extracted_page_v1(
  p_document_id uuid,
  p_processing_run_id uuid,
  p_page jsonb,
  p_records jsonb,
  p_review_issues jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_part integer;
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

  select d.part_number, d.source_language
  into v_document_part, v_document_language
  from public.uploaded_pdfs d
  where d.id = p_document_id;
  if not found then
    raise exception 'The source document does not exist.' using errcode = '23503';
  end if;
  if v_document_part not in (227, 228, 229, 230)
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
         where e.part_number = v_document_part
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
$$;

revoke all on function public.persist_extracted_page_v1(
  uuid, uuid, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.persist_extracted_page_v1(
  uuid, uuid, jsonb, jsonb, jsonb
) to authenticated, service_role;

comment on function public.persist_extracted_page_v1(
  uuid, uuid, jsonb, jsonb, jsonb
) is
  'Atomically persists one EN/TE extracted physical page, source records, review issues and audit evidence. Idempotent retries cannot overwrite preserved source OCR.';

