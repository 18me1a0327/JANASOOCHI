create table if not exists public.logical_voters (
  id uuid primary key default gen_random_uuid(),
  part_number integer not null check (part_number in (227, 228, 229, 230)),
  serial_number text not null check (btrim(serial_number) <> ''),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'inactive', 'requires_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_number, serial_number)
);

comment on table public.logical_voters is
  'One language-independent voter slot. Language-specific voter_records link here without overwriting source text.';
comment on column public.logical_voters.serial_number is
  'Canonical electoral-roll serial number within a supported Part.';

alter table public.voter_records
  add column if not exists logical_voter_id uuid
    references public.logical_voters(id) on delete set null;

create index if not exists voter_records_logical_language_idx
  on public.voter_records(logical_voter_id, original_language);

insert into public.logical_voters(part_number, serial_number, lifecycle_status)
select distinct r.part_number, r.serial_number, 'active'
from public.voter_records r
join public.uploaded_pdfs d on d.id = r.pdf_id
where d.active_version = true
  and r.original_language = 'en'
  and r.serial_number is not null
  and btrim(r.serial_number) <> ''
on conflict (part_number, serial_number) do update
set lifecycle_status = 'active', updated_at = now();

update public.voter_records r
set logical_voter_id = l.id
from public.logical_voters l
where r.part_number = l.part_number
  and r.serial_number = l.serial_number
  and r.logical_voter_id is distinct from l.id;

alter table public.logical_voters enable row level security;

drop policy if exists "read logical voters" on public.logical_voters;
create policy "read logical voters" on public.logical_voters
  for select to authenticated using (true);

drop policy if exists "admin insert logical voters" on public.logical_voters;
create policy "admin insert logical voters" on public.logical_voters
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "admin update logical voters" on public.logical_voters;
create policy "admin update logical voters" on public.logical_voters
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin delete logical voters" on public.logical_voters;
create policy "admin delete logical voters" on public.logical_voters
  for delete to authenticated using ((select public.is_admin()));

revoke all on table public.logical_voters from public, anon;
grant select on table public.logical_voters to authenticated;
grant insert, update, delete on table public.logical_voters to authenticated;

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
  with supported_languages(source_language) as (
    values ('en'::text), ('te'::text), ('ur'::text)
  ),
  logical_count as (
    select count(*)::bigint as logical_total
    from public.logical_voters l
    where l.lifecycle_status = 'active'
      and (p_part is null or l.part_number = p_part)
  ),
  source_count as (
    select
      r.original_language as source_language,
      count(*)::bigint as source_records,
      count(distinct l.id)::bigint as linked_records,
      count(*) filter (where l.id is null)::bigint as unlinked_records
    from public.voter_records r
    join public.uploaded_pdfs d on d.id = r.pdf_id
    left join public.logical_voters l
      on l.id = r.logical_voter_id
      and l.lifecycle_status = 'active'
    where d.active_version = true
      and r.original_language in ('en', 'te', 'ur')
      and (p_part is null or r.part_number = p_part)
    group by r.original_language
  )
  select
    languages.source_language,
    totals.logical_total,
    coalesce(sources.source_records, 0)::bigint,
    coalesce(sources.linked_records, 0)::bigint,
    coalesce(sources.unlinked_records, 0)::bigint,
    greatest(totals.logical_total - coalesce(sources.source_records, 0), 0)::bigint
  from supported_languages languages
  cross join logical_count totals
  left join source_count sources using (source_language)
  order by case languages.source_language when 'en' then 1 when 'te' then 2 else 3 end;
$$;

revoke all on function public.voter_language_coverage(integer) from public, anon;
grant execute on function public.voter_language_coverage(integer) to authenticated;

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

  update public.logical_voters
  set lifecycle_status = 'inactive', updated_at = now()
  where part_number = p_part;

  insert into public.logical_voters(part_number, serial_number, lifecycle_status)
  select distinct r.part_number, r.serial_number, 'active'
  from public.voter_records r
  join public.uploaded_pdfs d on d.id = r.pdf_id
  where d.active_version = true
    and d.part_number = p_part
    and r.original_language = 'en'
    and r.serial_number is not null
    and btrim(r.serial_number) <> ''
  on conflict (part_number, serial_number) do update
  set lifecycle_status = 'active', updated_at = now();

  update public.voter_records r
  set logical_voter_id = null
  where r.part_number = p_part
    and r.logical_voter_id is not null
    and not exists (
      select 1
      from public.logical_voters l
      where l.id = r.logical_voter_id
        and l.part_number = r.part_number
        and l.serial_number = r.serial_number
    );

  update public.voter_records r
  set logical_voter_id = l.id
  from public.logical_voters l
  where r.part_number = p_part
    and r.part_number = l.part_number
    and r.serial_number = l.serial_number
    and r.logical_voter_id is distinct from l.id;
end;
$$;

revoke all on function public.reconcile_logical_voters_for_part(integer) from public, anon;
grant execute on function public.reconcile_logical_voters_for_part(integer) to authenticated;
