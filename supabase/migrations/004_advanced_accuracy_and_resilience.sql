alter table public.uploaded_pdfs
  add column if not exists source_language text not null default 'en'
    check (source_language in ('en', 'te', 'ur')),
  add column if not exists detected_language text
    check (detected_language is null or detected_language in ('en', 'te', 'ur')),
  add column if not exists language_confidence real
    check (language_confidence is null or language_confidence between 0 and 100),
  add column if not exists revision_identifier text,
  add column if not exists active_version boolean not null default true,
  add column if not exists supersedes_id uuid references public.uploaded_pdfs(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists expected_voter_total integer check (expected_voter_total is null or expected_voter_total >= 0),
  add column if not exists review_records integer not null default 0 check (review_records >= 0),
  add column if not exists updated_at timestamptz not null default now();

update public.uploaded_pdfs
set source_language = case
  when filename ~* '[-_]TEL[-_]' then 'te'
  when filename ~* '[-_](URD|URDU)[-_]' then 'ur'
  else 'en'
end,
revision_identifier = coalesce(
  revision_identifier,
  (regexp_match(filename, '(?i)(revision[-_ ]*[0-9]+)'))[1],
  'initial'
),
completed_at = case when processing_status = 'completed' then uploaded_at else completed_at end;

alter table public.page_processing
  add column if not exists page_type text not null default 'unknown'
    check (page_type in ('cover', 'summary', 'map', 'voter', 'unknown')),
  add column if not exists detected_language text
    check (detected_language is null or detected_language in ('en', 'te', 'ur')),
  add column if not exists language_confidence real
    check (language_confidence is null or language_confidence between 0 and 100),
  add column if not exists review_records integer not null default 0 check (review_records >= 0),
  add column if not exists dropped_records integer not null default 0 check (dropped_records >= 0),
  add column if not exists error_type text,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0 check (retry_count between 0 and 2),
  add column if not exists processed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.page_processing
set processed_at = coalesce(processed_at, created_at)
where processed_at is null;

alter table public.voter_records
  add column if not exists transliterated_name text,
  add column if not exists transliterated_relation_name text,
  add column if not exists field_confidence jsonb not null default '{}'::jsonb,
  add column if not exists name_confidence real check (name_confidence is null or name_confidence between 0 and 100),
  add column if not exists relation_confidence real check (relation_confidence is null or relation_confidence between 0 and 100),
  add column if not exists house_confidence real check (house_confidence is null or house_confidence between 0 and 100),
  add column if not exists age_confidence real check (age_confidence is null or age_confidence between 0 and 100),
  add column if not exists epic_confidence real check (epic_confidence is null or epic_confidence between 0 and 100),
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.voter_records(id) on delete set null;

create table if not exists public.review_issues (
  id bigint generated always as identity primary key,
  pdf_id uuid not null references public.uploaded_pdfs(id) on delete cascade,
  page_id bigint references public.page_processing(id) on delete cascade,
  voter_id uuid references public.voter_records(id) on delete cascade,
  issue_type text not null check (issue_type in (
    'low_confidence', 'page_failure', 'language', 'missing_page',
    'malformed_record', 'possible_duplicate', 'manual_correction',
    'serial_gap', 'page_sequence'
  )),
  issue_detail text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_corrections (
  id bigint generated always as identity primary key,
  voter_id uuid not null references public.voter_records(id) on delete cascade,
  original_value jsonb not null,
  corrected_value jsonb not null,
  corrected_by uuid not null references auth.users(id),
  corrected_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists uploaded_pdfs_active_language_idx
  on public.uploaded_pdfs(part_number, source_language, active_version, uploaded_at desc);
create index if not exists voter_records_language_idx
  on public.voter_records(original_language, part_number);
create index if not exists voter_name_latin_trgm_idx
  on public.voter_records using gin(transliterated_name extensions.gin_trgm_ops);
create index if not exists voter_relation_latin_trgm_idx
  on public.voter_records using gin(transliterated_relation_name extensions.gin_trgm_ops);
create index if not exists voter_serial_idx on public.voter_records(part_number, serial_number);
create index if not exists voter_epic_idx on public.voter_records(epic_number);
create index if not exists voter_house_idx on public.voter_records(normalized_house_number);
create index if not exists voter_age_idx on public.voter_records(age);
create index if not exists voter_possible_duplicate_idx
  on public.voter_records(pdf_id, possible_duplicate) where possible_duplicate;
create index if not exists review_issues_open_idx
  on public.review_issues(status, issue_type, pdf_id) where status = 'open';
create index if not exists ocr_corrections_voter_idx
  on public.ocr_corrections(voter_id, corrected_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log(entity_type, entity_id, created_at desc);

alter table public.review_issues enable row level security;
alter table public.ocr_corrections enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated read review issues" on public.review_issues
  for select to authenticated using (true);
create policy "admin manage review issues" on public.review_issues
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "authenticated read corrections" on public.ocr_corrections
  for select to authenticated using (true);
create policy "admin create corrections" on public.ocr_corrections
  for insert to authenticated with check ((select public.is_admin()));

create policy "admin read audit log" on public.audit_log
  for select to authenticated using ((select public.is_admin()));
create policy "admin create audit log" on public.audit_log
  for insert to authenticated with check ((select public.is_admin()));

grant select on public.review_issues, public.ocr_corrections to authenticated;
grant select, insert, update, delete on public.review_issues to authenticated;
grant insert on public.ocr_corrections to authenticated;
grant select, insert on public.audit_log to authenticated;
grant usage, select on sequence public.review_issues_id_seq,
  public.ocr_corrections_id_seq, public.audit_log_id_seq to authenticated;

comment on column public.uploaded_pdfs.active_version is
  'Search defaults to records belonging to the active source revision.';
comment on column public.voter_records.transliterated_name is
  'Search-only Latin transliteration; original_name remains authoritative.';
comment on column public.voter_records.field_confidence is
  'Per-field OCR confidence percentages where OCR word data was available.';
