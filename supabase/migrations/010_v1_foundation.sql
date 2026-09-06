-- JANASOOCHI V1 foundation
--
-- This migration is intentionally additive and compatibility-first:
--   * voter_records remains the physical source table used by the current app;
--     source_records is a security-invoker compatibility view over it.
--   * uploaded_pdfs/page_processing/ocr_corrections remain intact and receive
--     uploaded_documents/pdf_pages/record_corrections compatibility views.
--   * no OCR/source value or audit row is deleted or overwritten.
--   * the canonical registry is the expected Part/Serial slot set. Ambiguous,
--     NULL, non-canonical and out-of-range legacy logical rows are quarantined,
--     not deleted. Empty canonical slots contain no fabricated voter fields.

-- ---------------------------------------------------------------------------
-- Canonical Part expectations (configuration, never voter data)
-- ---------------------------------------------------------------------------

create table if not exists public.part_expectations (
  part_number integer primary key
    check (part_number in (227, 228, 229, 230)),
  expected_voter_total integer not null check (expected_voter_total > 0),
  expected_serial_start integer not null check (expected_serial_start > 0),
  expected_serial_end integer not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (expected_serial_end >= expected_serial_start),
  check (expected_serial_end - expected_serial_start + 1 = expected_voter_total)
);

insert into public.part_expectations (
  part_number,
  expected_voter_total,
  expected_serial_start,
  expected_serial_end
)
values
  (227, 1014, 1, 1014),
  (228, 973, 1, 973),
  (229, 888, 1, 888),
  (230, 579, 1, 579)
on conflict (part_number) do update
set expected_voter_total = excluded.expected_voter_total,
    expected_serial_start = excluded.expected_serial_start,
    expected_serial_end = excluded.expected_serial_end,
    updated_by = null,
    updated_at = now();

comment on table public.part_expectations is
  'Expected canonical serial slots supplied by the JANASOOCHI requirements. These rows validate completeness and never synthesize voter attributes.';

-- ---------------------------------------------------------------------------
-- Canonical logical registry: exactly the configured expected slots are active
-- ---------------------------------------------------------------------------

alter table public.logical_voters
  add column if not exists expected_slot boolean not null default false,
  add column if not exists quarantine_reason text,
  add column if not exists verification_status public.verification_status
    not null default 'unverified',
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.logical_voters
  drop constraint if exists logical_voters_lifecycle_status_check;

alter table public.logical_voters
  add constraint logical_voters_lifecycle_status_check
  check (lifecycle_status in ('active', 'inactive', 'requires_review', 'quarantined'));

-- Quarantine every row that is not already the canonical decimal spelling of
-- a configured serial slot. The canonical source pointer is derived state, so it
-- is cleared on a quarantined row to avoid conflicting with the expected slot;
-- the logical row, source record and source record's own FK are all preserved.
update public.logical_voters l
set lifecycle_status = 'quarantined',
    expected_slot = false,
    canonical_source_record_id = null,
    quarantine_reason = case
      when l.serial_number is null then 'missing_serial'
      when btrim(l.serial_number) !~ '^[0-9]+$' then 'non_numeric_serial'
      when not exists (
        select 1
        from public.part_expectations e
        where e.part_number = l.part_number
          and btrim(l.serial_number) ~ '^[0-9]{1,9}$'
          and btrim(l.serial_number) =
            (case when btrim(l.serial_number) ~ '^[0-9]{1,9}$'
              then btrim(l.serial_number)::integer end)::text
          and (case when btrim(l.serial_number) ~ '^[0-9]{1,9}$'
            then btrim(l.serial_number)::integer end)
            between e.expected_serial_start and e.expected_serial_end
      ) then 'unexpected_or_noncanonical_serial'
      else 'legacy_orphan'
    end,
    updated_at = now()
where l.serial_number is null
   or btrim(l.serial_number) !~ '^[0-9]+$'
   or not exists (
     select 1
     from public.part_expectations e
     where e.part_number = l.part_number
       and btrim(l.serial_number) ~ '^[0-9]{1,9}$'
       and btrim(l.serial_number) =
         (case when btrim(l.serial_number) ~ '^[0-9]{1,9}$'
           then btrim(l.serial_number)::integer end)::text
       and (case when btrim(l.serial_number) ~ '^[0-9]{1,9}$'
         then btrim(l.serial_number)::integer end)
         between e.expected_serial_start and e.expected_serial_end
   );

-- Existing valid slots are retained; missing slots are structural placeholders
-- with no source record or voter attributes.
insert into public.logical_voters (
  part_number,
  serial_number,
  lifecycle_status,
  expected_slot,
  quarantine_reason
)
select
  e.part_number,
  serial_no::text,
  'active',
  true,
  null
from public.part_expectations e
cross join lateral generate_series(
  e.expected_serial_start,
  e.expected_serial_end
) as serial_no
on conflict (part_number, serial_number) do update
set lifecycle_status = 'active',
    expected_slot = true,
    quarantine_reason = null,
    updated_at = now();

-- A source record with a valid numeric serial links to the expected slot. This
-- updates only the derived FK; raw, normalized and corrected values are untouched.
update public.voter_records r
set logical_voter_id = l.id,
    updated_at = now()
from public.logical_voters l,
     public.part_expectations e
where e.part_number = r.part_number
  and l.part_number = r.part_number
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

-- Do not let malformed, missing or out-of-range source serials remain attached
-- to an expected slot after a legacy reconciliation. This changes only the
-- derived relationship and leaves every source/OCR value untouched.
update public.voter_records r
set logical_voter_id = null,
    updated_at = now()
from public.logical_voters l,
     public.part_expectations e
where l.id = r.logical_voter_id
  and l.expected_slot = true
  and e.part_number = r.part_number
  and (
    r.serial_number is null
    or btrim(r.serial_number) !~ '^[0-9]{1,9}$'
    or (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)
        not between e.expected_serial_start and e.expected_serial_end
    or l.part_number <> r.part_number
    or l.serial_number is distinct from
      (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)::text
  );

-- Canonical source assignment is deterministic only when exactly one active
-- English source row exists for a slot. Ambiguity remains visible for review.
with english_candidates as (
  select
    r.part_number,
    (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)::text as canonical_serial,
    min(r.id::text)::uuid as source_record_id,
    count(*) as candidate_count
  from public.voter_records r
  join public.uploaded_pdfs d
    on d.id = r.pdf_id
   and d.active_version = true
   and d.source_language = 'en'
  join public.part_expectations e on e.part_number = r.part_number
  where r.serial_number is not null
    and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
    and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)
      between e.expected_serial_start and e.expected_serial_end
  group by r.part_number,
    (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      then btrim(r.serial_number)::integer end)::text
)
update public.logical_voters l
set canonical_source_record_id = case
      when c.candidate_count = 1 then c.source_record_id
      else null
    end,
    updated_at = now()
from english_candidates c
where l.part_number = c.part_number
  and l.serial_number = c.canonical_serial
  and l.expected_slot = true;

-- Slots with no active English candidate must not retain a stale canonical row.
update public.logical_voters l
set canonical_source_record_id = null,
    updated_at = now()
where l.expected_slot = true
  and l.lifecycle_status = 'active'
  and not exists (
    select 1
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id
     and d.active_version = true
     and d.source_language = 'en'
    where r.part_number = l.part_number
      and r.serial_number is not null
      and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
      and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)::text = l.serial_number
  );

alter table public.logical_voters
  drop constraint if exists logical_voters_expected_slot_check;

alter table public.logical_voters
  add constraint logical_voters_expected_slot_check
  check (
    not expected_slot
    or case
      when serial_number ~ '^[0-9]{1,4}$' then
        (part_number = 227 and serial_number::integer between 1 and 1014)
        or (part_number = 228 and serial_number::integer between 1 and 973)
        or (part_number = 229 and serial_number::integer between 1 and 888)
        or (part_number = 230 and serial_number::integer between 1 and 579)
      else false
    end
  );

do $$
declare
  active_expected_count bigint;
  active_legacy_count bigint;
begin
  select count(*) into active_expected_count
  from public.logical_voters
  where expected_slot = true and lifecycle_status = 'active';

  select count(*) into active_legacy_count
  from public.logical_voters
  where expected_slot = false and lifecycle_status = 'active';

  if active_expected_count <> 3454 or active_legacy_count <> 0 then
    raise exception
      'Canonical registry invariant failed: expected 3454 active slots and 0 active legacy rows, found % and %',
      active_expected_count,
      active_legacy_count;
  end if;
end
$$;

comment on column public.logical_voters.expected_slot is
  'True only for a configured canonical Part/Serial slot. Active expected slots total 3,454; a slot may intentionally have no linked source data.';
comment on column public.logical_voters.quarantine_reason is
  'Why a preserved legacy logical row is excluded from the active canonical registry.';

-- ---------------------------------------------------------------------------
-- Source, page and processing provenance
-- ---------------------------------------------------------------------------

alter table public.voter_records
  add column if not exists source_card_index smallint
    check (source_card_index is null or source_card_index between 1 and 30),
  add column if not exists extraction_method text
    check (extraction_method is null or extraction_method in (
      'embedded_text', 'ocr', 'hybrid', 'manual'
    )),
  add column if not exists normalization_version text,
  add column if not exists verification_evidence jsonb not null default '{}'::jsonb,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

create table if not exists public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.uploaded_pdfs(id) on delete cascade,
  status text not null default 'queued'
    check (status in (
      'queued', 'validating', 'processing', 'paused', 'completed',
      'completed_with_warnings', 'failed', 'cancelled'
    )),
  stage text not null default 'validation'
    check (stage in (
      'validation', 'rendering', 'segmentation', 'extraction', 'ocr',
      'normalization', 'reconciliation', 'completeness', 'review', 'completed'
    )),
  source_language text
    check (source_language is null or source_language in ('en', 'te', 'ur')),
  attempt_number smallint not null default 1 check (attempt_number >= 1),
  total_pages integer not null default 0 check (total_pages >= 0),
  processed_pages integer not null default 0 check (processed_pages >= 0),
  succeeded_pages integer not null default 0 check (succeeded_pages >= 0),
  failed_pages integer not null default 0 check (failed_pages >= 0),
  cards_detected integer not null default 0 check (cards_detected >= 0),
  records_extracted integer not null default 0 check (records_extracted >= 0),
  resume_state jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.page_processing
  add column if not exists processing_run_id uuid
    references public.processing_runs(id) on delete set null,
  add column if not exists render_attempts smallint not null default 0
    check (render_attempts between 0 and 3),
  add column if not exists extraction_attempts smallint not null default 0
    check (extraction_attempts between 0 and 3),
  add column if not exists card_states jsonb not null default '[]'::jsonb,
  add column if not exists resumable boolean not null default true,
  add column if not exists last_error_at timestamptz;

comment on table public.processing_runs is
  'One resumable document-processing attempt. Page/card progress remains independently persisted.';
comment on column public.page_processing.card_states is
  'Per-card status, attempts, confidence and bounding box for the fixed 3-column x 10-row layout when applicable.';

-- ---------------------------------------------------------------------------
-- Roles: retain profiles.role for current clients and synchronize user_roles
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'viewer',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_roles (user_id, role, assigned_at)
select p.id, p.role, p.created_at
from public.profiles p
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();

create or replace function public.sync_profile_role_to_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.user_roles (user_id, role, assigned_by, assigned_at, updated_at)
  values (new.id, new.role, (select auth.uid()), now(), now())
  on conflict (user_id) do update
  set role = excluded.role,
      assigned_by = coalesce(excluded.assigned_by, public.user_roles.assigned_by),
      updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_user_role_to_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.profiles (id, role)
  values (new.user_id, new.role)
  on conflict (id) do update
  set role = excluded.role
  where public.profiles.role is distinct from excluded.role;

  return new;
end;
$$;

revoke all on function public.sync_profile_role_to_user_roles() from public, anon, authenticated;
revoke all on function public.sync_user_role_to_profiles() from public, anon, authenticated;

drop trigger if exists profiles_sync_user_roles on public.profiles;
create trigger profiles_sync_user_roles
after insert or update of role on public.profiles
for each row execute function public.sync_profile_role_to_user_roles();

drop trigger if exists user_roles_sync_profiles on public.user_roles;
create trigger user_roles_sync_profiles
after insert or update of role on public.user_roles
for each row execute function public.sync_user_role_to_profiles();

comment on table public.user_roles is
  'Explicit authorization roles. New profiles still default to viewer; no public first-signup-to-admin path is created.';

create or replace function public.is_authorized_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
    )
$$;

revoke all on function public.is_authorized_user() from public, anon;
grant execute on function public.is_authorized_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Review classification, corrections and immutable audit/export history
-- ---------------------------------------------------------------------------

alter table public.review_issues
  add column if not exists severity text not null default 'needs_review'
    check (severity in ('critical', 'needs_review', 'informational')),
  add column if not exists resolution_type text,
  add column if not exists resolution_reason text,
  add column if not exists resolution_metadata jsonb not null default '{}'::jsonb,
  add column if not exists original_values jsonb not null default '{}'::jsonb,
  add column if not exists resulting_values jsonb not null default '{}'::jsonb,
  add column if not exists auto_resolved boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Low confidence alone is informational. Structural/identity conflicts remain
-- Critical; existing rows and their status/history are preserved.
update public.review_issues
set severity = case
  when issue_type = 'low_confidence' then 'informational'
  when issue_type in (
    'page_failure', 'missing_page', 'malformed_record',
    'possible_duplicate', 'serial_gap', 'page_sequence',
    'missing_serial', 'duplicate_serial', 'unexpected_serial',
    'duplicate_epic', 'card_count_mismatch', 'partial_page',
    'reconciliation_conflict', 'verification_conflict'
  ) then 'critical'
  else 'needs_review'
end
where severity = 'needs_review';

alter table public.review_issues
  drop constraint if exists review_issues_issue_type_check;

alter table public.review_issues
  add constraint review_issues_issue_type_check
  check (issue_type in (
    'low_confidence', 'page_failure', 'language', 'missing_page',
    'malformed_record', 'possible_duplicate', 'manual_correction',
    'serial_gap', 'page_sequence', 'missing_serial', 'duplicate_serial',
    'unexpected_serial', 'duplicate_epic', 'card_count_mismatch',
    'partial_page', 'reconciliation_conflict', 'language_incomplete',
    'verification_conflict'
  ));

alter table public.ocr_corrections
  add column if not exists field_name text,
  add column if not exists correction_reason text,
  add column if not exists resolution_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.audit_log
  add column if not exists request_id uuid,
  add column if not exists operation_status text not null default 'succeeded'
    check (operation_status in ('attempted', 'succeeded', 'failed'));

create table if not exists public.dataset_exports (
  id uuid primary key default gen_random_uuid(),
  export_format text not null check (export_format in ('csv', 'json', 'parquet')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'expired')),
  filters jsonb not null default '{}'::jsonb,
  record_count integer check (record_count is null or record_count >= 0),
  storage_path text,
  checksum text,
  requested_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dataset_exports is
  'Admin-only audited exports. CSV/JSON are V1 formats; Parquet is reserved for the later data-science phase.';

-- ---------------------------------------------------------------------------
-- Compatibility views: new V1 names, existing storage preserved
-- ---------------------------------------------------------------------------

create or replace view public.uploaded_documents
with (security_invoker = true)
as
select
  p.id,
  p.filename,
  p.part_number,
  p.source_language,
  p.detected_language,
  p.language_confidence,
  p.total_pdf_pages,
  p.processed_pages,
  p.failed_pages,
  p.records_count,
  p.review_records,
  p.processing_status,
  p.storage_path,
  p.checksum,
  p.revision_identifier,
  p.active_version,
  p.supersedes_id,
  p.expected_voter_total,
  p.uploaded_by,
  p.uploaded_at,
  p.completed_at,
  p.updated_at
from public.uploaded_pdfs p;

create or replace view public.pdf_pages
with (security_invoker = true)
as
select
  p.id,
  p.pdf_id as document_id,
  p.processing_run_id,
  p.pdf_page_number as physical_page_number,
  p.printed_page_number,
  p.page_type,
  p.status,
  p.detected_language,
  p.language_confidence,
  p.ocr_confidence,
  p.records_detected,
  p.records_extracted,
  p.review_records,
  p.dropped_records,
  p.retry_count,
  p.render_attempts,
  p.extraction_attempts,
  p.card_states,
  p.resumable,
  p.error_type,
  p.error_message,
  p.issue_detail,
  p.last_error_at,
  p.processed_at,
  p.created_at,
  p.updated_at
from public.page_processing p;

create or replace view public.source_records
with (security_invoker = true)
as
select
  r.id,
  r.logical_voter_id,
  r.pdf_id as document_id,
  r.part_number,
  r.serial_number,
  r.original_name,
  r.normalized_name,
  r.transliterated_name,
  r.relation_type,
  r.original_relation_name,
  r.normalized_relation_name,
  r.transliterated_relation_name,
  r.original_house_number,
  r.normalized_house_number,
  r.age,
  r.gender,
  r.epic_number,
  r.pdf_page_number as physical_page_number,
  r.printed_page_number,
  r.source_card_index,
  r.original_text,
  r.original_language as source_language,
  r.extraction_method,
  r.ocr_confidence,
  r.field_confidence,
  r.name_confidence,
  r.relation_confidence,
  r.house_confidence,
  r.age_confidence,
  r.epic_confidence,
  r.bounding_box,
  r.normalization_version,
  r.verification_status,
  r.verification_evidence,
  r.corrected_value,
  r.corrected_by,
  r.corrected_at,
  r.verified_by,
  r.verified_at,
  r.possible_duplicate,
  r.duplicate_of,
  r.created_at,
  r.updated_at
from public.voter_records r;

create or replace view public.record_corrections
with (security_invoker = true)
as
select
  c.id,
  c.voter_id as source_record_id,
  c.field_name,
  c.original_value,
  c.corrected_value,
  c.correction_reason,
  c.resolution_type,
  c.metadata,
  c.corrected_by,
  c.corrected_at
from public.ocr_corrections c;

comment on view public.source_records is
  'V1 name for language-specific source rows. Backed by voter_records so current clients and all existing source history remain compatible.';

-- ---------------------------------------------------------------------------
-- Indexes for exact search, review, resumability, RLS and audit operations
-- ---------------------------------------------------------------------------

create index if not exists logical_voters_active_registry_idx
  on public.logical_voters(part_number, serial_number)
  where expected_slot = true and lifecycle_status = 'active';
create index if not exists logical_voters_verification_idx
  on public.logical_voters(verification_status, part_number)
  where expected_slot = true and lifecycle_status = 'active';
create index if not exists logical_voters_verified_by_idx
  on public.logical_voters(verified_by);

create index if not exists voter_records_part_language_serial_idx
  on public.voter_records(part_number, original_language, serial_number);
create index if not exists voter_records_part_epic_idx
  on public.voter_records(part_number, epic_number)
  where epic_number is not null;
create index if not exists voter_records_verification_idx
  on public.voter_records(verification_status, part_number, original_language);
create index if not exists voter_records_verified_by_idx
  on public.voter_records(verified_by);

create index if not exists processing_runs_document_created_idx
  on public.processing_runs(document_id, created_at desc);
create index if not exists processing_runs_active_idx
  on public.processing_runs(status, updated_at desc)
  where status in ('queued', 'validating', 'processing', 'paused');
create index if not exists processing_runs_started_by_idx
  on public.processing_runs(started_by);
create index if not exists page_processing_run_page_idx
  on public.page_processing(processing_run_id, pdf_page_number);

create index if not exists user_roles_role_idx on public.user_roles(role, user_id);
create index if not exists user_roles_assigned_by_idx on public.user_roles(assigned_by);
create index if not exists part_expectations_updated_by_idx
  on public.part_expectations(updated_by);

create index if not exists review_issues_severity_queue_idx
  on public.review_issues(severity, status, created_at desc, id desc);
create index if not exists review_issues_open_severity_idx
  on public.review_issues(severity, created_at desc, id desc)
  where status = 'open';

create index if not exists dataset_exports_requested_by_idx
  on public.dataset_exports(requested_by, requested_at desc);
create index if not exists dataset_exports_status_idx
  on public.dataset_exports(status, requested_at desc);
create unique index if not exists dataset_exports_storage_path_uidx
  on public.dataset_exports(storage_path)
  where storage_path is not null;
create index if not exists audit_log_created_idx
  on public.audit_log(created_at desc, id desc);
create index if not exists audit_log_request_idx
  on public.audit_log(request_id)
  where request_id is not null;

-- ---------------------------------------------------------------------------
-- RLS and explicit Data API grants (required for current Supabase exposure mode)
-- ---------------------------------------------------------------------------

alter table public.part_expectations enable row level security;
alter table public.processing_runs enable row level security;
alter table public.user_roles enable row level security;
alter table public.dataset_exports enable row level security;

-- A signed-in Auth identity is not sufficient on its own: only identities
-- provisioned into profiles by the controlled administrator workflow may read
-- voter data. This also excludes Supabase anonymous-auth users.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );

drop policy if exists "read documents" on public.uploaded_pdfs;
create policy "read documents" on public.uploaded_pdfs
  for select to authenticated using ((select public.is_authorized_user()));

drop policy if exists "read voters" on public.voter_records;
create policy "read voters" on public.voter_records
  for select to authenticated using ((select public.is_authorized_user()));

drop policy if exists "read pages" on public.page_processing;
create policy "read pages" on public.page_processing
  for select to authenticated using ((select public.is_authorized_user()));

drop policy if exists "read logical voters" on public.logical_voters;
create policy "read logical voters" on public.logical_voters
  for select to authenticated using ((select public.is_authorized_user()));

drop policy if exists "authenticated read part expectations" on public.part_expectations;
create policy "authenticated read part expectations" on public.part_expectations
  for select to authenticated using ((select public.is_authorized_user()));
drop policy if exists "admin manage part expectations" on public.part_expectations;
create policy "admin manage part expectations" on public.part_expectations
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin read processing runs" on public.processing_runs;
create policy "admin read processing runs" on public.processing_runs
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin insert processing runs" on public.processing_runs;
create policy "admin insert processing runs" on public.processing_runs
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin update processing runs" on public.processing_runs;
create policy "admin update processing runs" on public.processing_runs
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "admin delete processing runs" on public.processing_runs;
create policy "admin delete processing runs" on public.processing_runs
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "read own user role" on public.user_roles;
create policy "read own user role" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admin insert user roles" on public.user_roles;
create policy "admin insert user roles" on public.user_roles
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin update user roles" on public.user_roles;
create policy "admin update user roles" on public.user_roles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "admin delete user roles" on public.user_roles;

drop policy if exists "admin read dataset exports" on public.dataset_exports;
create policy "admin read dataset exports" on public.dataset_exports
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin insert dataset exports" on public.dataset_exports;
create policy "admin insert dataset exports" on public.dataset_exports
  for insert to authenticated
  with check ((select public.is_admin()) and requested_by = (select auth.uid()));
drop policy if exists "admin update dataset exports" on public.dataset_exports;
create policy "admin update dataset exports" on public.dataset_exports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "admin delete dataset exports" on public.dataset_exports;

-- Review issues, corrections, audit rows and export requests are append/update
-- history. They are retained; clients cannot delete them.
drop policy if exists "admin delete review issues" on public.review_issues;

revoke all on table public.part_expectations, public.processing_runs,
  public.user_roles, public.dataset_exports from public, anon, authenticated;
grant select on table public.part_expectations to authenticated;
grant select, insert, update, delete on table public.processing_runs,
  public.user_roles, public.dataset_exports to authenticated;
revoke delete on table public.user_roles, public.dataset_exports from authenticated;

revoke all on table public.review_issues, public.ocr_corrections,
  public.audit_log from public, anon, authenticated;
grant select, insert, update on table public.review_issues to authenticated;
grant select, insert on table public.ocr_corrections, public.audit_log
  to authenticated;

revoke all on table public.uploaded_documents, public.pdf_pages,
  public.source_records, public.record_corrections
  from public, anon, authenticated;
grant select on table public.uploaded_documents, public.pdf_pages,
  public.source_records, public.record_corrections to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage buckets and complete admin upsert/delete policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'voter-pdfs',
  'voter-pdfs',
  false,
  104857600,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated read pdf" on storage.objects;
create policy "authenticated read pdf"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voter-pdfs'
    and (select public.is_authorized_user())
  );

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'verified-exports',
  'verified-exports',
  false,
  array['text/csv', 'application/json', 'application/octet-stream']
)
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin update pdf" on storage.objects;
create policy "admin update pdf"
  on storage.objects for update to authenticated
  using (bucket_id = 'voter-pdfs' and (select public.is_admin()))
  with check (bucket_id = 'voter-pdfs' and (select public.is_admin()));

drop policy if exists "admin read verified exports" on storage.objects;
create policy "admin read verified exports"
  on storage.objects for select to authenticated
  using (bucket_id = 'verified-exports' and (select public.is_admin()));
drop policy if exists "admin insert verified exports" on storage.objects;
create policy "admin insert verified exports"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verified-exports' and (select public.is_admin()));
drop policy if exists "admin update verified exports" on storage.objects;
create policy "admin update verified exports"
  on storage.objects for update to authenticated
  using (bucket_id = 'verified-exports' and (select public.is_admin()))
  with check (bucket_id = 'verified-exports' and (select public.is_admin()));
drop policy if exists "admin delete verified exports" on storage.objects;
create policy "admin delete verified exports"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verified-exports' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Reconciliation and paginated data-quality RPCs
-- ---------------------------------------------------------------------------

create or replace function public.reconcile_logical_voters_for_part(p_part integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_part not in (227, 228, 229, 230) then
    raise exception 'Unsupported Part';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  insert into public.logical_voters (
    part_number,
    serial_number,
    lifecycle_status,
    expected_slot,
    quarantine_reason
  )
  select e.part_number, serial_no::text, 'active', true, null
  from public.part_expectations e
  cross join lateral generate_series(
    e.expected_serial_start,
    e.expected_serial_end
  ) as serial_no
  where e.part_number = p_part
  on conflict (part_number, serial_number) do update
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
  where l.part_number = p_part
    and not exists (
      select 1
      from public.part_expectations e
      where e.part_number = l.part_number
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
  where r.part_number = p_part
    and e.part_number = r.part_number
    and l.part_number = r.part_number
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
  where r.part_number = p_part
    and l.id = r.logical_voter_id
    and l.expected_slot = true
    and e.part_number = r.part_number
    and (
      r.serial_number is null
      or btrim(r.serial_number) !~ '^[0-9]{1,9}$'
      or (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        then btrim(r.serial_number)::integer end)
          not between e.expected_serial_start and e.expected_serial_end
      or l.part_number <> r.part_number
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
    join public.part_expectations e on e.part_number = r.part_number
    where r.part_number = p_part
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
  where l.part_number = p_part
    and l.serial_number = c.canonical_serial
    and l.expected_slot = true;

  update public.logical_voters l
  set canonical_source_record_id = null,
      updated_at = now()
  where l.part_number = p_part
    and l.expected_slot = true
    and not exists (
      select 1
      from public.voter_records r
      join public.uploaded_pdfs d
        on d.id = r.pdf_id
       and d.active_version = true
       and d.source_language = 'en'
      where r.part_number = p_part
        and r.serial_number is not null
        and btrim(r.serial_number) ~ '^[0-9]{1,9}$'
        and (case when btrim(r.serial_number) ~ '^[0-9]{1,9}$'
          then btrim(r.serial_number)::integer end)::text = l.serial_number
    );

  if (
    select count(*)
    from public.logical_voters l
    where l.part_number = p_part
      and l.expected_slot = true
      and l.lifecycle_status = 'active'
  ) <> (
    select e.expected_voter_total
    from public.part_expectations e
    where e.part_number = p_part
  ) then
    raise exception 'Canonical registry invariant failed for Part %', p_part;
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
    'part',
    p_part::text,
    jsonb_build_object('strategy', 'part_serial_expected_slots')
  );
end;
$$;

create or replace function public.voter_language_coverage(p_part integer default null)
returns table (
  source_language text,
  logical_total bigint,
  source_records bigint,
  linked_records bigint,
  unlinked_records bigint,
  unavailable_records bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with supported_languages(source_language, language_order) as (
    values ('en'::text, 1), ('te'::text, 2), ('ur'::text, 3)
  ),
  logical_count as (
    select count(*)::bigint as logical_total
    from public.logical_voters l
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
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
$$;

create or replace function public.get_part_language_quality()
returns table (
  part_number integer,
  source_language text,
  expected_slots bigint,
  source_record_count bigint,
  linked_slot_count bigint,
  missing_slot_count bigint,
  unlinked_source_count bigint
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

  return query
  with languages(source_language) as (
    values ('en'::text), ('te'::text), ('ur'::text)
  ),
  source_counts as (
    select
      r.part_number,
      d.source_language,
      count(*)::bigint as source_record_count,
      count(distinct l.id)::bigint as linked_slot_count,
      count(*) filter (where l.id is null)::bigint as unlinked_source_count
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    left join public.logical_voters l
      on l.id = r.logical_voter_id
     and l.expected_slot = true
     and l.lifecycle_status = 'active'
    where d.source_language in ('en', 'te', 'ur')
    group by r.part_number, d.source_language
  )
  select
    e.part_number,
    languages.source_language,
    e.expected_voter_total::bigint,
    coalesce(s.source_record_count, 0)::bigint,
    coalesce(s.linked_slot_count, 0)::bigint,
    greatest(
      e.expected_voter_total::bigint - coalesce(s.linked_slot_count, 0),
      0
    )::bigint,
    coalesce(s.unlinked_source_count, 0)::bigint
  from public.part_expectations e
  cross join languages
  left join source_counts s
    on s.part_number = e.part_number
   and s.source_language = languages.source_language
  order by e.part_number,
    case languages.source_language when 'en' then 1 when 'te' then 2 else 3 end;
end;
$$;

create or replace function public.get_serial_completeness_page(
  p_part integer,
  p_language text default null,
  p_status text default 'all',
  p_limit integer default 50,
  p_after_cursor text default null
)
returns table (
  serial_number text,
  serial_status text,
  occurrence_count bigint,
  source_record_ids uuid[],
  page_cursor text,
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
  if p_part not in (227, 228, 229, 230) then
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
  ),
  active_sources as (
    select r.id, r.serial_number
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where r.part_number = p_part
      and p_language is not null
      and d.source_language = p_language
  ),
  canonical_sources as (
    select l.canonical_source_record_id as id, l.serial_number
    from public.logical_voters l
    where l.part_number = p_part
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
$$;

create or replace function public.get_data_quality_summary(
  p_part integer default null,
  p_language text default null
)
returns table (
  expected_slots bigint,
  active_logical_voters bigint,
  extracted_source_records bigint,
  linked_source_records bigint,
  missing_serials bigint,
  duplicate_serial_groups bigint,
  unexpected_serials bigint,
  duplicate_epic_groups bigint,
  expected_voter_cards bigint,
  extracted_voter_cards bigint,
  failed_pages bigint,
  partial_pages bigint,
  null_name_records bigint,
  null_relation_records bigint,
  null_house_records bigint,
  null_age_records bigint,
  null_epic_records bigint,
  reconciliation_conflicts bigint,
  critical_issues bigint,
  needs_review_issues bigint,
  informational_issues bigint,
  verified_logical_voters bigint,
  unverified_logical_voters bigint
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
  if p_language is not null and p_language not in ('en', 'te', 'ur') then
    raise exception 'Unsupported language';
  end if;

  return query
  with expectations as (
    select e.*
    from public.part_expectations e
    where p_part is null or e.part_number = p_part
  ),
  logical_scope as (
    select l.*
    from public.logical_voters l
    where l.expected_slot = true
      and l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
  ),
  source_scope as (
    select r.*, d.source_language as document_language
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where (p_part is null or r.part_number = p_part)
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
      and (p_language is null or d.source_language = p_language)
  ),
  issue_scope as (
    select i.*
    from public.review_issues i
    join public.uploaded_pdfs d
      on d.id = i.pdf_id and d.active_version = true
    where i.status = 'open'
      and (p_part is null or d.part_number = p_part)
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
$$;

comment on function public.get_serial_completeness_page(integer, text, text, integer, text) is
  'Cursor-paginated missing/duplicate/unexpected serial diagnostics; never builds a browser-side UUID IN list.';
comment on function public.get_data_quality_summary(integer, text) is
  'Admin-only aggregate quality metrics. Logical counts use canonical expected slots, never EN+TE+UR source-row totals.';

revoke all on function public.reconcile_logical_voters_for_part(integer)
  from public, anon;
revoke all on function public.voter_language_coverage(integer)
  from public, anon;
revoke all on function public.get_part_language_quality()
  from public, anon;
revoke all on function public.get_serial_completeness_page(integer, text, text, integer, text)
  from public, anon;
revoke all on function public.get_data_quality_summary(integer, text)
  from public, anon;

grant execute on function public.reconcile_logical_voters_for_part(integer)
  to authenticated;
grant execute on function public.voter_language_coverage(integer)
  to authenticated;
grant execute on function public.get_part_language_quality()
  to authenticated;
grant execute on function public.get_serial_completeness_page(integer, text, text, integer, text)
  to authenticated;
grant execute on function public.get_data_quality_summary(integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Paginated voter search (all filters use AND logic)
-- ---------------------------------------------------------------------------

create or replace function public.search_source_records_page(
  p_part integer default null,
  p_language text default 'en',
  p_name text default null,
  p_relation_name text default null,
  p_relation_type text default null,
  p_house_number text default null,
  p_age integer default null,
  p_gender text default null,
  p_epic text default null,
  p_serial text default null,
  p_fuzzy boolean default true,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  logical_voter_id uuid,
  document_id uuid,
  part_number integer,
  serial_number text,
  voter_name text,
  relation_type text,
  relation_name text,
  house_number text,
  age integer,
  gender text,
  epic_number text,
  physical_page_number integer,
  printed_page_number integer,
  source_language text,
  verification_status public.verification_status,
  ocr_confidence real,
  bounding_box jsonb,
  match_score numeric,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_part is not null and p_part not in (227, 228, 229, 230) then
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
    where r.part_number in (227, 228, 229, 230)
      and (p_part is null or r.part_number = p_part)
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
$$;

comment on function public.search_source_records_page(
  integer, text, text, text, text, text, integer, text, text, text,
  boolean, integer, integer
) is
  'Server-side paginated active-source search. Supplied filters use AND logic; exact identifiers stay exact and fuzzy text matching is threshold-controlled.';

revoke all on function public.search_source_records_page(
  integer, text, text, text, text, text, integer, text, text, text,
  boolean, integer, integer
) from public, anon;
grant execute on function public.search_source_records_page(
  integer, text, text, text, text, text, integer, text, text, text,
  boolean, integer, integer
) to authenticated;

create or replace function public.get_master_dataset_page(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  logical_voter_id uuid,
  part_number integer,
  serial_number text,
  verification_status public.verification_status,
  verified_at timestamptz,
  source_records jsonb,
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

  return query
  select
    l.id,
    l.part_number,
    l.serial_number,
    l.verification_status,
    l.verified_at,
    coalesce(s.sources, '[]'::jsonb),
    count(*) over ()::bigint
  from public.logical_voters l
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'language', coalesce(r.original_language, d.source_language),
      'name', coalesce(nullif(r.corrected_value ->> 'original_name', ''), r.original_name),
      'relation_type', r.relation_type,
      'relation_name', coalesce(nullif(r.corrected_value ->> 'original_relation_name', ''), r.original_relation_name),
      'house_number', coalesce(nullif(r.corrected_value ->> 'original_house_number', ''), r.original_house_number),
      'age', coalesce(
        case when (r.corrected_value ->> 'age') ~ '^[0-9]+$' then (r.corrected_value ->> 'age')::integer end,
        r.age
      ),
      'gender', coalesce(nullif(r.corrected_value ->> 'gender', ''), r.gender),
      'epic', coalesce(nullif(r.corrected_value ->> 'epic_number', ''), r.epic_number),
      'document_id', r.pdf_id,
      'physical_page', r.pdf_page_number,
      'printed_page', r.printed_page_number,
      'verification_status', r.verification_status,
      'ocr_confidence', r.ocr_confidence
    ) order by
      case coalesce(r.original_language, d.source_language)
        when 'en' then 1 when 'te' then 2 else 3 end,
      r.id
    ) as sources
    from public.voter_records r
    join public.uploaded_pdfs d
      on d.id = r.pdf_id and d.active_version = true
    where r.logical_voter_id = l.id
      and coalesce(r.original_language, d.source_language) in ('en', 'te', 'ur')
  ) s on true
  where l.expected_slot = true
    and l.lifecycle_status = 'active'
  order by l.part_number, l.serial_number::integer
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.get_master_dataset_page(integer, integer) is
  'Admin-only paginated canonical 3,454-slot export source with linked language representations and verification state.';
revoke all on function public.get_master_dataset_page(integer, integer) from public, anon;
grant execute on function public.get_master_dataset_page(integer, integer) to authenticated;

create or replace function public.record_dataset_export(
  p_format text,
  p_record_count integer,
  p_status text default 'completed',
  p_error_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  export_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_format not in ('csv', 'json') then
    raise exception 'Unsupported export format';
  end if;
  if p_status not in ('completed', 'failed') then
    raise exception 'Unsupported export status';
  end if;

  insert into public.dataset_exports (
    export_format, status, record_count, completed_at, error_message, metadata
  ) values (
    p_format,
    p_status,
    greatest(coalesce(p_record_count, 0), 0),
    case when p_status = 'completed' then now() else null end,
    p_error_message,
    jsonb_build_object('delivery', 'authenticated_browser_download')
  ) returning id into export_id;

  insert into public.audit_log (action, actor_id, entity_type, entity_id, metadata)
  values (
    'dataset.export.' || p_status,
    (select auth.uid()),
    'dataset_export',
    export_id::text,
    jsonb_build_object('format', p_format, 'record_count', greatest(coalesce(p_record_count, 0), 0))
  );

  return export_id;
end;
$$;

revoke all on function public.record_dataset_export(text, integer, text, text) from public, anon;
grant execute on function public.record_dataset_export(text, integer, text, text) to authenticated;

-- Explicit sequence grants for new identity-free tables are unnecessary. Existing
-- correction/review/audit identity sequences retain their previous grants.
