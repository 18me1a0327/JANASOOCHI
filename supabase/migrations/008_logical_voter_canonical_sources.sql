alter table public.logical_voters
  add column if not exists canonical_source_record_id uuid
    references public.voter_records(id) on delete set null;

alter table public.logical_voters
  alter column serial_number drop not null;

alter table public.logical_voters
  drop constraint if exists logical_voters_serial_number_check;

alter table public.logical_voters
  add constraint logical_voters_serial_number_check
  check (serial_number is null or btrim(serial_number) <> '');

create unique index if not exists logical_voters_canonical_source_uidx
  on public.logical_voters(canonical_source_record_id)
  where canonical_source_record_id is not null;

comment on column public.logical_voters.canonical_source_record_id is
  'The active English source row that defines this language-independent voter slot.';
comment on column public.logical_voters.serial_number is
  'Canonical electoral-roll serial when unambiguous; NULL when source OCR requires review.';

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
  set lifecycle_status = 'inactive', canonical_source_record_id = null, updated_at = now()
  where part_number = p_part;

  with english_records as (
    select
      r.id,
      r.part_number,
      case
        when r.serial_number is not null
          and btrim(r.serial_number) <> ''
          and count(*) over (partition by r.part_number, r.serial_number) = 1
        then r.serial_number
        else null
      end as canonical_serial
    from public.voter_records r
    join public.uploaded_pdfs d on d.id = r.pdf_id
    where d.active_version = true
      and d.source_language = 'en'
      and r.part_number = p_part
  )
  insert into public.logical_voters(part_number, serial_number, lifecycle_status, canonical_source_record_id)
  select part_number, canonical_serial, 'active', id
  from english_records
  where canonical_serial is not null
  on conflict (part_number, serial_number) do update
  set lifecycle_status = 'active',
      canonical_source_record_id = excluded.canonical_source_record_id,
      updated_at = now();

  with english_records as (
    select r.id, r.part_number
    from public.voter_records r
    join public.uploaded_pdfs d on d.id = r.pdf_id
    where d.active_version = true
      and d.source_language = 'en'
      and r.part_number = p_part
  )
  insert into public.logical_voters(part_number, serial_number, lifecycle_status, canonical_source_record_id)
  select e.part_number, null, 'active', e.id
  from english_records e
  where not exists (
    select 1 from public.logical_voters l
    where l.canonical_source_record_id = e.id
  );

  update public.voter_records r
  set logical_voter_id = null
  from public.uploaded_pdfs d
  where d.id = r.pdf_id
    and d.active_version = true
    and r.part_number = p_part;

  update public.voter_records r
  set logical_voter_id = l.id
  from public.logical_voters l
  where l.canonical_source_record_id = r.id
    and l.lifecycle_status = 'active'
    and r.part_number = p_part;

  update public.voter_records r
  set logical_voter_id = l.id
  from public.uploaded_pdfs d,
       public.logical_voters l
  where d.id = r.pdf_id
    and d.active_version = true
    and d.source_language <> 'en'
    and r.part_number = p_part
    and r.logical_voter_id is null
    and r.serial_number is not null
    and l.part_number = r.part_number
    and l.serial_number = r.serial_number
    and l.lifecycle_status = 'active';

  with epic_matches as (
    select source.id as source_id, min(l.id::text)::uuid as logical_id
    from public.voter_records source
    join public.uploaded_pdfs source_pdf
      on source_pdf.id = source.pdf_id and source_pdf.active_version = true
    join public.voter_records english
      on english.part_number = source.part_number
      and english.epic_number = source.epic_number
    join public.uploaded_pdfs english_pdf
      on english_pdf.id = english.pdf_id
      and english_pdf.active_version = true
      and english_pdf.source_language = 'en'
    join public.logical_voters l
      on l.canonical_source_record_id = english.id
      and l.lifecycle_status = 'active'
    where source_pdf.source_language <> 'en'
      and source.part_number = p_part
      and source.logical_voter_id is null
      and source.epic_number is not null
    group by source.id
    having count(distinct l.id) = 1
  )
  update public.voter_records r
  set logical_voter_id = m.logical_id
  from epic_matches m
  where r.id = m.source_id;
end;
$$;

revoke all on function public.reconcile_logical_voters_for_part(integer) from public, anon;
grant execute on function public.reconcile_logical_voters_for_part(integer) to authenticated;

-- Rebuild the derived logical layer for the current active source documents.
-- Original voter rows and OCR values are never changed by this migration.
update public.logical_voters
set lifecycle_status = 'inactive', canonical_source_record_id = null, updated_at = now();

with english_records as (
  select
    r.id,
    r.part_number,
    case
      when r.serial_number is not null
        and btrim(r.serial_number) <> ''
        and count(*) over (partition by r.part_number, r.serial_number) = 1
      then r.serial_number
      else null
    end as canonical_serial
  from public.voter_records r
  join public.uploaded_pdfs d on d.id = r.pdf_id
  where d.active_version = true and d.source_language = 'en'
)
insert into public.logical_voters(part_number, serial_number, lifecycle_status, canonical_source_record_id)
select part_number, canonical_serial, 'active', id
from english_records
where canonical_serial is not null
on conflict (part_number, serial_number) do update
set lifecycle_status = 'active',
    canonical_source_record_id = excluded.canonical_source_record_id,
    updated_at = now();

with english_records as (
  select r.id, r.part_number
  from public.voter_records r
  join public.uploaded_pdfs d on d.id = r.pdf_id
  where d.active_version = true and d.source_language = 'en'
)
insert into public.logical_voters(part_number, serial_number, lifecycle_status, canonical_source_record_id)
select e.part_number, null, 'active', e.id
from english_records e
where not exists (
  select 1 from public.logical_voters l
  where l.canonical_source_record_id = e.id
);

update public.voter_records r
set logical_voter_id = null
from public.uploaded_pdfs d
where d.id = r.pdf_id and d.active_version = true;

update public.voter_records r
set logical_voter_id = l.id
from public.logical_voters l
where l.canonical_source_record_id = r.id
  and l.lifecycle_status = 'active';

update public.voter_records r
set logical_voter_id = l.id
from public.uploaded_pdfs d,
     public.logical_voters l
where d.id = r.pdf_id
  and d.active_version = true
  and d.source_language <> 'en'
  and r.logical_voter_id is null
  and r.serial_number is not null
  and l.part_number = r.part_number
  and l.serial_number = r.serial_number
  and l.lifecycle_status = 'active';

with epic_matches as (
  select source.id as source_id, min(l.id::text)::uuid as logical_id
  from public.voter_records source
  join public.uploaded_pdfs source_pdf
    on source_pdf.id = source.pdf_id and source_pdf.active_version = true
  join public.voter_records english
    on english.part_number = source.part_number
    and english.epic_number = source.epic_number
  join public.uploaded_pdfs english_pdf
    on english_pdf.id = english.pdf_id
    and english_pdf.active_version = true
    and english_pdf.source_language = 'en'
  join public.logical_voters l
    on l.canonical_source_record_id = english.id
    and l.lifecycle_status = 'active'
  where source_pdf.source_language <> 'en'
    and source.logical_voter_id is null
    and source.epic_number is not null
  group by source.id
  having count(distinct l.id) = 1
)
update public.voter_records r
set logical_voter_id = m.logical_id
from epic_matches m
where r.id = m.source_id;
