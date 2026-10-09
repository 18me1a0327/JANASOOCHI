-- Stage 1A: additive Andhra Pradesh geography foundation.
-- This migration only adds metadata structure and maps the already-existing pilot
-- source rows; it does not overwrite voter/source/audit values.
begin;

create table if not exists public.states (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_document text,
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified','needs_review')),
  created_at timestamptz not null default now()
);

create table if not exists public.ap_geography_reference (
  id bigint generated always as identity primary key,
  state_code text not null,
  pc_number integer not null,
  pc_name text not null,
  pc_name_source text not null,
  pc_reserved_category text not null check (pc_reserved_category in ('NONE','SC','ST')),
  ac_number integer not null,
  ac_name text not null,
  ac_name_source text not null,
  ac_reserved_category text not null check (ac_reserved_category in ('NONE','SC','ST')),
  source_document text not null,
  source_reference text not null,
  source_page integer,
  verification_status text not null check (verification_status in ('official_source_derived','verified','unverified','needs_review')),
  unique (state_code, pc_number, ac_number)
);

create table if not exists public.parliamentary_constituencies (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete restrict,
  pc_number integer not null check (pc_number > 0),
  name text not null,
  name_source text not null,
  reserved_category text not null check (reserved_category in ('NONE','SC','ST')),
  created_at timestamptz not null default now(),
  unique (state_id, pc_number)
);

create table if not exists public.assembly_constituencies (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete restrict,
  parliamentary_constituency_id uuid not null references public.parliamentary_constituencies(id) on delete restrict,
  ac_number integer not null check (ac_number > 0),
  name text not null,
  name_source text not null,
  reserved_category text not null check (reserved_category in ('NONE','SC','ST')),
  created_at timestamptz not null default now(),
  unique (state_id, ac_number),
  unique (parliamentary_constituency_id, ac_number)
);

create table if not exists public.electoral_revisions (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete restrict,
  code text not null,
  revision_year integer,
  roll_type text,
  qualifying_date date,
  publication_date date,
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified','needs_review')),
  created_at timestamptz not null default now(),
  unique (state_id, code)
);

create table if not exists public.electoral_parts (
  id uuid primary key default gen_random_uuid(),
  assembly_constituency_id uuid not null references public.assembly_constituencies(id) on delete restrict,
  revision_id uuid not null references public.electoral_revisions(id) on delete restrict,
  part_number integer not null check (part_number > 0),
  polling_station_name text,
  polling_station_address text,
  expected_voter_total integer check (expected_voter_total is null or expected_voter_total >= 0),
  geography_verification_status text not null default 'unverified' check (geography_verification_status in ('verified_from_source_header','unverified','needs_review')),
  created_at timestamptz not null default now(),
  unique (assembly_constituency_id, revision_id, part_number)
);

-- Existing source-document/page tables remain authoritative. These nullable FKs
-- add statewide ownership without duplicating uploaded_pdfs or page_processing.
alter table public.uploaded_pdfs add column if not exists state_id uuid references public.states(id) on delete restrict;
alter table public.uploaded_pdfs add column if not exists parliamentary_constituency_id uuid references public.parliamentary_constituencies(id) on delete restrict;
alter table public.uploaded_pdfs add column if not exists assembly_constituency_id uuid references public.assembly_constituencies(id) on delete restrict;
alter table public.uploaded_pdfs add column if not exists electoral_part_id uuid references public.electoral_parts(id) on delete restrict;
alter table public.uploaded_pdfs add column if not exists revision_id uuid references public.electoral_revisions(id) on delete restrict;
alter table public.uploaded_pdfs add column if not exists document_type text;
alter table public.uploaded_pdfs add column if not exists geography_verification_status text not null default 'unverified' check (geography_verification_status in ('verified_from_source_header','unverified','needs_review'));

alter table public.logical_voters add column if not exists electoral_part_id uuid references public.electoral_parts(id) on delete restrict;
alter table public.logical_voters add column if not exists revision_id uuid references public.electoral_revisions(id) on delete restrict;
alter table public.voter_records add column if not exists electoral_part_id uuid references public.electoral_parts(id) on delete restrict;
alter table public.voter_records add column if not exists revision_id uuid references public.electoral_revisions(id) on delete restrict;
-- source_records is an existing compatibility view over the normalized source
-- tables, so its geography is inherited from uploaded_pdfs/voter_records and
-- must not be altered as if it were a base table.
alter table public.part_expectations add column if not exists electoral_part_id uuid references public.electoral_parts(id) on delete restrict;
alter table public.part_expectations add column if not exists revision_id uuid references public.electoral_revisions(id) on delete restrict;

-- The pilot-only checks prevented future Parts. Removing only those checks leaves
-- language, age, relation, checksum, and source-integrity checks intact.
alter table public.uploaded_pdfs drop constraint if exists uploaded_pdfs_part_number_check;
alter table public.voter_records drop constraint if exists voter_records_part_number_check;
alter table public.logical_voters drop constraint if exists logical_voters_part_number_check;
alter table public.logical_voters drop constraint if exists logical_voters_expected_slot_check;
alter table public.part_expectations drop constraint if exists part_expectations_part_number_check;

insert into public.states(code, name, source_document, verification_status)
values ('AP', 'Andhra Pradesh', 'Official ECI/AP geography references documented in docs/AP_OFFICIAL_DATA_SOURCES.md', 'verified')
on conflict (code) do update set name = excluded.name, source_document = excluded.source_document;

insert into public.ap_geography_reference (state_code, pc_number, pc_name, pc_name_source, pc_reserved_category, ac_number, ac_name, ac_name_source, ac_reserved_category, source_document, source_reference, source_page, verification_status)
values
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 10, 'Palakonda (ST)', 'Palakonda (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 11, 'Kurupam (ST)', 'Kurupam (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 12, 'Parvathipuram (SC)', 'Parvathipuram (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 13, 'Salur (ST)', 'Salur (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 28, 'Araku Valley (ST)', 'Araku Valley (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 29, 'Paderu (ST)', 'Paderu (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 1, 'Araku', 'ARAKU', 'ST', 53, 'Rampachodavaram (ST)', 'Rampachodavaram (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 1, 'Ichchapuram', 'Ichchapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 2, 'Palasa', 'Palasa', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 3, 'Tekkali', 'Tekkali', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 4, 'Pathapatnam', 'Pathapatnam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 5, 'Srikakulam', 'Srikakulam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 6, 'Amadalavalasa', 'Amadalavalasa', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 2, 'Srikakulam', 'SRIKAKULAM', 'NONE', 8, 'Narasannapeta', 'Narasannapeta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 7, 'Etcherla', 'Etcherla', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 9, 'Rajam (SC)', 'Rajam (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 14, 'Bobbili', 'Bobbili', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 15, 'Cheepurupalli', 'Cheepurupalli', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 16, 'Gajapathinagaram', 'Gajapathinagaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 17, 'Nellimarla', 'Nellimarla', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 3, 'Vizianagaram', 'VIZIANAGARAM', 'NONE', 18, 'Vizianagaram', 'Vizianagaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 19, 'Srungavarapukota', 'Srungavarapukota', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 20, 'Bhimili', 'Bhimili', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 21, 'Visakhapatnam East', 'Visakhapatnam East', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 22, 'Visakhapatnam South', 'Visakhapatnam South', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 23, 'Visakhapatnam North', 'Visakhapatnam North', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 24, 'Visakhapatnam West', 'Visakhapatnam West', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 4, 'Visakhapatnam', 'VISAKHAPATNAM', 'NONE', 25, 'Gajuwaka', 'Gajuwaka', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 26, 'Chodavaram', 'Chodavaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 27, 'Madugula', 'Madugula', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 30, 'Anakapalle', 'Anakapalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 31, 'Pendurthi', 'Pendurthi', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 32, 'Yelamanchili', 'Yelamanchili', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 33, 'Payakaraopet (SC)', 'Payakaraopet (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 5, 'Anakapalle', 'ANAKAPALLE', 'NONE', 34, 'Narsipatnam', 'Narsipatnam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 35, 'Tuni', 'Tuni', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 36, 'Prathipadu', 'Prathipadu', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 37, 'Pithapuram', 'Pithapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 38, 'Kakinada Rural', 'Kakinada Rural', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 39, 'Peddapuram', 'Peddapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 40, 'Anaparthy', 'Anaparthy', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 41, 'Kakinada City', 'Kakinada City', 'NONE', 'Andhra Pradesh Reorganisation Act, 2014 � Second Schedule, Table B', 'https://upload.indiacode.nic.in/showfile?actid=AC_CEN_5_5_00058_201406_1517807327989&filename=201406.pdf&type=actfile', 41, 'official_source_derived'),
  ('AP', 6, 'Kakinada', 'KAKINADA', 'NONE', 52, 'Jaggampeta', 'Jaggampeta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 42, 'Ramachandrapuram', 'Ramachandrapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 43, 'Mummidivaram', 'Mummidivaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 44, 'Amalapuram (SC)', 'Amalapuram (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 45, 'Razole (SC)', 'Razole (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 46, 'Gannavaram (SC)', 'Gannavaram (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 47, 'Kothapeta', 'Kothapeta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 7, 'Amalapuram', 'AMALAPURAM', 'SC', 48, 'Mandapeta', 'Mandapeta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 49, 'Rajanagaram', 'Rajanagaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 50, 'Rajahmundry City', 'Rajahmundry City', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 51, 'Rajahmundry Rural', 'Rajahmundry Rural', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 54, 'Kovvur (SC)', 'Kovvur (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 55, 'Nidadavole', 'Nidadavole', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 8, 'Rajahmundry', 'RAJAHMUNDRY', 'NONE', 66, 'Gopalapuram (SC)', 'Gopalapuram (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 56, 'Achanta', 'Achanta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 57, 'Palacole', 'Palacole', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 58, 'Narasapuram', 'Narasapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 59, 'Bhimavaram', 'Bhimavaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 60, 'Undi', 'Undi', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 61, 'Tanuku', 'Tanuku', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 9, 'Narsapuram', 'NARSAPURAM', 'NONE', 62, 'Tadepalligudem', 'Tadepalligudem', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 63, 'Unguturu', 'Unguturu', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 64, 'Denduluru', 'Denduluru', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 65, 'Eluru', 'Eluru', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 67, 'Polavaram (ST)', 'Polavaram (ST)', 'ST', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 68, 'Chintalapudi (SC)', 'Chintalapudi (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 70, 'Nuzvid', 'Nuzvid', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 10, 'Eluru', 'ELURU', 'NONE', 73, 'Kaikalur', 'Kaikalur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 30, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 71, 'Gannavaram', 'Gannavaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 72, 'Gudivada', 'Gudivada', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 74, 'Pedana', 'Pedana', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 75, 'Machilipatnam', 'Machilipatnam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 76, 'Avanigadda', 'Avanigadda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 77, 'Pamarru (SC)', 'Pamarru (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 11, 'Machilipatnam', 'MACHILIPATNAM', 'NONE', 78, 'Penamaluru', 'Penamaluru', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 69, 'Tiruvuru (SC)', 'Tiruvuru (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 79, 'Vijayawada West', 'Vijayawada West', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 80, 'Vijayawada Central', 'Vijayawada Central', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 81, 'Vijayawada East', 'Vijayawada East', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 82, 'Mylavaram', 'Mylavaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 83, 'Nandigama (SC)', 'Nandigama (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 12, 'Vijayawada', 'VIJAYAWADA', 'NONE', 84, 'Jaggayyapeta', 'Jaggayyapeta', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 85, 'Pedakurapadu', 'Pedakurapadu', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 86, 'Tadikonda (SC)', 'Tadikonda (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 87, 'Mangalagiri', 'Mangalagiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 88, 'Ponnuru', 'Ponnuru', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 91, 'Tenali', 'Tenali', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 93, 'Prathipadu (SC)', 'Prathipadu (SC)', 'SC', 'Andhra Pradesh Reorganisation Act, 2014 � Second Schedule, Table B', 'https://upload.indiacode.nic.in/showfile?actid=AC_CEN_5_5_00058_201406_1517807327989&filename=201406.pdf&type=actfile', 41, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 94, 'Guntur West', 'Guntur West', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 13, 'Guntur', 'GUNTUR', 'NONE', 95, 'Guntur East', 'Guntur East', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 96, 'Chilakaluripet', 'Chilakaluripet', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 97, 'Narasaraopet', 'Narasaraopet', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 98, 'Sattenapalle', 'Sattenapalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 99, 'Vinukonda', 'Vinukonda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 100, 'Gurajala', 'Gurajala', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 14, 'Narasaraopet', 'NARASARAOPET', 'NONE', 101, 'Macherla', 'Macherla', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 89, 'Vemuru (SC)', 'Vemuru (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 90, 'Repalle', 'Repalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 92, 'Bapatla', 'Bapatla', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 104, 'Parchur', 'Parchur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 105, 'Addanki', 'Addanki', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 106, 'Chirala', 'Chirala', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 15, 'Bapatla', 'BAPATLA', 'SC', 107, 'Santhanuthalapadu (SC)', 'Santhanuthalapadu (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 102, 'Yerragondapalem (SC)', 'Yerragondapalem (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 103, 'Darsi', 'Darsi', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 108, 'Ongole', 'Ongole', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 110, 'Kondapi (SC)', 'Kondapi (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 111, 'Markapuram', 'Markapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 112, 'Giddalur', 'Giddalur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 16, 'Ongole', 'ONGOLE', 'NONE', 113, 'Kanigiri', 'Kanigiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 134, 'Allagadda', 'Allagadda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 135, 'Srisailam', 'Srisailam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 136, 'Nandikotkur (SC)', 'Nandikotkur (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 138, 'Panyam', 'Panyam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 139, 'Nandyal', 'Nandyal', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 140, 'Banaganapalle', 'Banaganapalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 17, 'Nandyal', 'NANDYAL', 'NONE', 141, 'Dhone', 'Dhone', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 137, 'Kurnool', 'Kurnool', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 142, 'Pattikonda', 'Pattikonda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 143, 'Kodumur (SC)', 'Kodumur (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 144, 'Yemmiganur', 'Yemmiganur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 145, 'Mantralayam', 'Mantralayam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 146, 'Adoni', 'Adoni', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 18, 'Kurnool', 'KURNOOL', 'NONE', 147, 'Alur', 'Alur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 148, 'Rayadurg', 'Rayadurg', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 149, 'Uravakonda', 'Uravakonda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 150, 'Guntakal', 'Guntakal', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 151, 'Tadpatri', 'Tadpatri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 152, 'Singanamala (SC)', 'Singanamala (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 153, 'Anantapur Urban', 'Anantapur Urban', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 19, 'Anantapur', 'ANANTAPUR', 'NONE', 154, 'Kalyandurg', 'Kalyandurg', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 155, 'Raptadu', 'Raptadu', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 156, 'Madakasira (SC)', 'Madakasira (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 157, 'Hindupur', 'Hindupur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 158, 'Penukonda', 'Penukonda', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 159, 'Puttaparthi', 'Puttaparthi', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 160, 'Dharmavaram', 'Dharmavaram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 20, 'Hindupur', 'HINDUPUR', 'NONE', 161, 'Kadiri', 'Kadiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 124, 'Badvel (SC)', 'Badvel (SC)', 'SC', 'Delimitation of Parliamentary andAssembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 126, 'Kadapa', 'Kadapa', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 129, 'Pulivendla', 'Pulivendla', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 130, 'Kamalapuram', 'Kamalapuram', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 131, 'Jammalamadugu', 'Jammalamadugu', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 132, 'Proddatur', 'Proddatur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 21, 'Kadapa', 'KADAPA', 'NONE', 133, 'Mydukur', 'Mydukur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 109, 'Kandukur', 'Kandukur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 114, 'Kavali', 'Kavali', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 115, 'Atmakur', 'Atmakur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 116, 'Kovur', 'Kovur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 117, 'Nellore City', 'Nellore City', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 118, 'Nellore Rural', 'Nellore Rural', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 22, 'Nellore', 'NELLORE', 'NONE', 123, 'Udayagiri', 'Udayagiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 119, 'Sarvepalli', 'Sarvepalli', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 120, 'Gudur (SC)', 'Gudur (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 121, 'Sullurpeta (SC)', 'Sullurpeta (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 122, 'Venkatagiri', 'Venkatagiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 167, 'Tirupati', 'Tirupati', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 168, 'Srikalahasti', 'Srikalahasti', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 23, 'Tirupati', 'TIRUPATI', 'SC', 169, 'Satyavedu (SC)', 'Satyavedu (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 125, 'Rajampet', 'Rajampet', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 127, 'Kodur (SC)', 'Kodur (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 128, 'Rayachoti', 'Rayachoti', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 162, 'Thamballapalle', 'Thamballapalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 163, 'Pileru', 'Pileru', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 164, 'Madanapalle', 'Madanapalle', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 24, 'Rajampet', 'RAJAMPET', 'NONE', 165, 'Punganur', 'Punganur', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 31, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 166, 'Chandragiri', 'Chandragiri', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 170, 'Nagari', 'Nagari', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 171, 'Gangadhara Nellore (SC)', 'Gangadhara Nellore (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 172, 'Chittoor', 'Chittoor', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 173, 'Puthalapattu (SC)', 'Puthalapattu (SC)', 'SC', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 174, 'Palamaner', 'Palamaner', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived'),
  ('AP', 25, 'Chittoor', 'CHITTOOR', 'SC', 175, 'Kuppam', 'Kuppam', 'NONE', 'Delimitation of Parliamentary and Assembly Constituencies Order, 2008 � Schedule III', 'https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf', 32, 'official_source_derived')
on conflict (state_code, pc_number, ac_number) do update set
  pc_name = excluded.pc_name,
  pc_name_source = excluded.pc_name_source,
  pc_reserved_category = excluded.pc_reserved_category,
  ac_name = excluded.ac_name,
  ac_name_source = excluded.ac_name_source,
  ac_reserved_category = excluded.ac_reserved_category,
  source_document = excluded.source_document,
  source_reference = excluded.source_reference,
  source_page = excluded.source_page,
  verification_status = excluded.verification_status;

insert into public.parliamentary_constituencies (state_id, pc_number, name, name_source, reserved_category)
select s.id, r.pc_number, min(r.pc_name), min(r.pc_name_source), min(r.pc_reserved_category)
from public.ap_geography_reference r
join public.states s on s.code = r.state_code
group by s.id, r.pc_number
on conflict (state_id, pc_number) do update set name = excluded.name, name_source = excluded.name_source, reserved_category = excluded.reserved_category;

insert into public.assembly_constituencies (state_id, parliamentary_constituency_id, ac_number, name, name_source, reserved_category)
select s.id, pc.id, r.ac_number, r.ac_name, r.ac_name_source, r.ac_reserved_category
from public.ap_geography_reference r
join public.states s on s.code = r.state_code
join public.parliamentary_constituencies pc on pc.state_id = s.id and pc.pc_number = r.pc_number
on conflict (state_id, ac_number) do update set parliamentary_constituency_id = excluded.parliamentary_constituency_id, name = excluded.name, name_source = excluded.name_source, reserved_category = excluded.reserved_category;

insert into public.electoral_revisions (state_id, code, revision_year, roll_type, qualifying_date, publication_date, verification_status)
select id, '2026-SIR-DRAFT-REV1', 2026, 'Special Intensive Revision - Draft Roll', date '2026-07-01', date '2026-07-31', 'verified'
from public.states where code = 'AP'
on conflict (state_id, code) do update set revision_year = excluded.revision_year, roll_type = excluded.roll_type, qualifying_date = excluded.qualifying_date, publication_date = excluded.publication_date, verification_status = excluded.verification_status;

insert into public.electoral_parts (assembly_constituency_id, revision_id, part_number, polling_station_name, expected_voter_total, geography_verification_status)
select ac.id, rev.id, x.part_number, 'Pallerlamudi', x.expected_voter_total, 'verified_from_source_header'
from (values (227,1014),(228,973),(229,888),(230,579)) as x(part_number, expected_voter_total)
join public.states s on s.code = 'AP'
join public.assembly_constituencies ac on ac.state_id = s.id and ac.ac_number = 70
join public.electoral_revisions rev on rev.state_id = s.id and rev.code = '2026-SIR-DRAFT-REV1'
on conflict (assembly_constituency_id, revision_id, part_number) do update set polling_station_name = excluded.polling_station_name, expected_voter_total = excluded.expected_voter_total, geography_verification_status = excluded.geography_verification_status;

-- Scope every existing pilot source/document row by the verified header metadata.
update public.uploaded_pdfs d set
 state_id = s.id,
 parliamentary_constituency_id = pc.id,
 assembly_constituency_id = ac.id,
 electoral_part_id = ep.id,
 revision_id = rev.id,
 document_type = 'draft_roll',
 geography_verification_status = 'verified_from_source_header'
from public.states s
join public.parliamentary_constituencies pc on pc.state_id = s.id and pc.pc_number = 10
join public.assembly_constituencies ac on ac.state_id = s.id and ac.parliamentary_constituency_id = pc.id and ac.ac_number = 70
join public.electoral_revisions rev on rev.state_id = s.id and rev.code = '2026-SIR-DRAFT-REV1'
join public.electoral_parts ep on ep.assembly_constituency_id = ac.id and ep.revision_id = rev.id
where s.code = 'AP' and d.part_number in (227,228,229,230) and ep.part_number = d.part_number;

update public.logical_voters l set electoral_part_id = ep.id, revision_id = rev.id
from public.states s
join public.assembly_constituencies ac on ac.state_id = s.id and ac.ac_number = 70
join public.electoral_revisions rev on rev.state_id = s.id and rev.code = '2026-SIR-DRAFT-REV1'
join public.electoral_parts ep on ep.assembly_constituency_id = ac.id and ep.revision_id = rev.id
where s.code = 'AP' and l.part_number in (227,228,229,230) and ep.part_number = l.part_number;

update public.voter_records v set electoral_part_id = d.electoral_part_id, revision_id = d.revision_id
from public.uploaded_pdfs d where d.id = v.pdf_id and d.electoral_part_id is not null;
update public.part_expectations e set electoral_part_id = ep.id, revision_id = rev.id
from public.states s
join public.assembly_constituencies ac on ac.state_id = s.id and ac.ac_number = 70
join public.electoral_revisions rev on rev.state_id = s.id and rev.code = '2026-SIR-DRAFT-REV1'
join public.electoral_parts ep on ep.assembly_constituency_id = ac.id and ep.revision_id = rev.id
where s.code = 'AP' and e.part_number in (227,228,229,230) and ep.part_number = e.part_number;

-- Replace pilot-global logical identity with revision/geography-scoped identity.
alter table public.logical_voters drop constraint if exists logical_voters_part_number_serial_number_key;
alter table public.logical_voters add constraint logical_voters_revision_part_serial_key unique (revision_id, electoral_part_id, serial_number);
alter table public.part_expectations drop constraint if exists part_expectations_pkey;
alter table public.part_expectations add constraint part_expectations_part_revision_key unique (electoral_part_id, revision_id);

create index if not exists uploaded_pdfs_scope_idx on public.uploaded_pdfs(state_id, parliamentary_constituency_id, assembly_constituency_id, electoral_part_id, revision_id);
create index if not exists logical_voters_scope_idx on public.logical_voters(revision_id, electoral_part_id, part_number, serial_number);
create index if not exists voter_records_scope_idx on public.voter_records(revision_id, electoral_part_id, part_number, serial_number);

alter table public.states enable row level security;
alter table public.ap_geography_reference enable row level security;
alter table public.parliamentary_constituencies enable row level security;
alter table public.assembly_constituencies enable row level security;
alter table public.electoral_revisions enable row level security;
alter table public.electoral_parts enable row level security;

do $$ begin
  create policy "authenticated read states" on public.states for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read ap geography" on public.ap_geography_reference for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read pcs" on public.parliamentary_constituencies for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read acs" on public.assembly_constituencies for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read revisions" on public.electoral_revisions for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read parts" on public.electoral_parts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage states" on public.states for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage ap geography" on public.ap_geography_reference for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage pcs" on public.parliamentary_constituencies for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage acs" on public.assembly_constituencies for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage revisions" on public.electoral_revisions for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manage parts" on public.electoral_parts for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

comment on table public.ap_geography_reference is 'Official AP PC/AC reference. Source periods and limitations are documented in docs/AP_OFFICIAL_DATA_SOURCES.md.';
comment on table public.electoral_parts is 'Revision/AC-scoped Parts. Part number is not globally unique.';
comment on column public.logical_voters.revision_id is 'Revision-scoped identity; never assume Part+Serial is permanent across revisions.';
commit;

