\set ON_ERROR_STOP 1
begin;
insert into auth.users(id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','admin@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','viewer@test.local','authenticated','authenticated');
insert into public.user_roles(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','admin'),('00000000-0000-0000-0000-0000000000b2','viewer') on conflict (user_id) do update set role = excluded.role;
insert into public.assembly_constituencies(id, state_id, parliamentary_constituency_id, ac_number, name, name_source, reserved_category)
select '00000000-0000-0000-0000-00000000ac02', state_id, parliamentary_constituency_id, 999, 'Test AC', 'test', 'NONE'
from public.assembly_constituencies limit 1;
create temp table ctx as select ep.id as pilot_part, ep.revision_id as rev from public.electoral_parts ep where part_number = 227;
grant select on ctx to authenticated;

-- viewer cannot import
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  perform public.import_verified_electoral_parts_v1('00000000-0000-0000-0000-00000000ac02', (select rev from ctx), 'hdr', '[{"part_number":227,"expected_voter_total":3}]');
  raise exception 'viewer import should fail';
exception when insufficient_privilege then raise notice 'PASS viewer import denied';
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  perform public.import_verified_electoral_parts_v1('00000000-0000-0000-0000-00000000ac02', (select rev from ctx), 'hdr', '[{"part_number":227,"expected_voter_total":3,"expected_serial_end":9}]');
  raise exception 'bad serial range should fail';
exception when sqlstate '22023' then raise notice 'PASS invalid range rejected: %', sqlerrm;
end $$;
do $$ begin
  perform public.import_verified_electoral_parts_v1('00000000-0000-0000-0000-00000000ac02', (select rev from ctx), '  ', '[{"part_number":227,"expected_voter_total":3}]');
  raise exception 'missing source should fail';
exception when sqlstate '22023' then raise notice 'PASS missing source rejected';
end $$;
select * from public.import_verified_electoral_parts_v1('00000000-0000-0000-0000-00000000ac02', (select rev from ctx), 'Form-16 header p1', '[{"part_number":227,"expected_voter_total":3,"polling_station_name":"Test School"}]');
select * from public.import_verified_electoral_parts_v1('00000000-0000-0000-0000-00000000ac02', (select rev from ctx), 'Form-16 header p1 (corrected)', '[{"part_number":227,"expected_voter_total":3,"polling_station_name":"Test School 2"}]');
reset role;
alter table ctx add column ac2_part uuid;
update ctx set ac2_part = (select id from public.electoral_parts where assembly_constituency_id='00000000-0000-0000-0000-00000000ac02');

insert into public.uploaded_pdfs(id, filename, part_number, total_pdf_pages, processing_status, storage_path, checksum, uploaded_by, source_language, electoral_part_id, revision_id, assembly_constituency_id)
select '00000000-0000-0000-0000-0000000d0c01'::uuid,'pilot.pdf',227,1,'completed','t/pilot.pdf','c1','00000000-0000-0000-0000-0000000000a1'::uuid,'en', pilot_part, rev, null::uuid from ctx
union all
select '00000000-0000-0000-0000-0000000d0c02'::uuid,'ac2.pdf',227,1,'completed','t/ac2.pdf','c2','00000000-0000-0000-0000-0000000000a1'::uuid,'en', ac2_part, rev, '00000000-0000-0000-0000-00000000ac02'::uuid from ctx;
insert into public.voter_records(pdf_id, part_number, serial_number, original_name, normalized_name, relation_type, pdf_page_number, original_text, original_language, verification_status)
values ('00000000-0000-0000-0000-0000000d0c01',227,'1','Pilot Person','pilot person','Father',1,'x','en','unverified'),
       ('00000000-0000-0000-0000-0000000d0c02',227,'1','Other AC Person','other ac person','Father',1,'x','en','unverified');
select 'trigger filled', count(*) filter (where electoral_part_id is not null and revision_id is not null) from public.voter_records;
do $$ begin
  if exists (select 1 from public.voter_records r join ctx on true where r.pdf_id='00000000-0000-0000-0000-0000000d0c02' and r.electoral_part_id <> ctx.ac2_part) then raise exception 'trigger wrong part'; end if;
end $$;
do $$ begin
  insert into public.voter_records(pdf_id, part_number, serial_number, relation_type, pdf_page_number, original_text, electoral_part_id, verification_status)
  select '00000000-0000-0000-0000-0000000d0c02',227,'2','Father',1,'x', pilot_part, 'unverified' from ctx;
  raise exception 'mismatched part should fail';
exception when sqlstate '22023' then raise notice 'PASS cross-part record rejected';
end $$;

set local role authenticated;
do $$ begin
  perform public.reconcile_logical_voters_for_part(227);
  raise exception 'ambiguous should fail';
exception when sqlstate '22023' then raise notice 'PASS ambiguous legacy reconcile rejected: %', sqlerrm;
end $$;
select public.reconcile_logical_voters_for_electoral_part(pilot_part) from ctx;
select public.reconcile_logical_voters_for_electoral_part(ac2_part) from ctx;
reset role;
select 'logical per part', electoral_part_id = (select ac2_part from ctx) as ac2, count(*), count(canonical_source_record_id) from public.logical_voters group by 2 order by 2;
select 'linked', r.original_name, l.electoral_part_id = r.electoral_part_id from public.voter_records r join public.logical_voters l on l.id = r.logical_voter_id;
set local role authenticated;
select 'search ac2', voter_name, total_count from public.search_source_records_page(p_part => 227, p_electoral_part_id => (select ac2_part from ctx));
select 'search pilot', voter_name, total_count from public.search_source_records_page(p_part => 227, p_electoral_part_id => (select pilot_part from ctx));
select 'search legacy', count(*) from public.search_source_records_page(p_part => 227);
select 'dq ac2', expected_slots, active_logical_voters, extracted_source_records from public.get_data_quality_summary(p_part => 227, p_electoral_part_id => (select ac2_part from ctx));
select 'dq ac scope', expected_slots from public.get_data_quality_summary(p_assembly_constituency_id => '00000000-0000-0000-0000-00000000ac02');
select 'insights ac2', expected_total, available_total from public.get_voter_insights_v1(p_electoral_part_id => (select ac2_part from ctx));
select 'recon ac2', part_number, expected_slots, source_records from public.get_revision_reconciliation_summary_v1(p_electoral_part_id => (select ac2_part from ctx));
select 'evidence ac2', count(*) from public.get_reconciliation_evidence_page_v1(p_electoral_part_id => (select ac2_part from ctx));
select 'coverage ac2', source_language, logical_total, source_records from public.voter_language_coverage(p_electoral_part_id => (select ac2_part from ctx));
select 'serial ac2', count(*) from public.get_serial_completeness_page(227, p_electoral_part_id => (select ac2_part from ctx));
select 'review ac2', count(*) from public.get_review_issues_page_v2(p_part => 227, p_electoral_part_id => (select ac2_part from ctx));
do $$
declare
  c record;
  n bigint;
begin
  select * into c from ctx;
  select count(*) into n from public.search_source_records_page(p_part => 227, p_electoral_part_id => c.ac2_part) where voter_name = 'Pilot Person';
  if n <> 0 then raise exception 'AC scope leaked a pilot record into search'; end if;
  select count(*) into n from public.search_source_records_page(p_part => 227, p_electoral_part_id => c.pilot_part) where voter_name = 'Other AC Person';
  if n <> 0 then raise exception 'Pilot scope leaked another AC record into search'; end if;
  select expected_slots into n from public.get_data_quality_summary(p_electoral_part_id => c.ac2_part);
  if n <> 3 then raise exception 'Data Quality expected slots % for imported Part', n; end if;
  select expected_total into n from public.get_voter_insights_v1(p_electoral_part_id => c.pilot_part);
  if n <> 1014 then raise exception 'Insights expected total % for pilot Part', n; end if;
  select count(*) into n from public.logical_voters l where l.electoral_part_id = c.ac2_part and l.expected_slot;
  if n <> 3 then raise exception 'Reconciliation created % slots for imported Part', n; end if;
  raise notice 'PASS same Part number stays isolated across Assembly Constituencies';
end $$;
reset role;
select 'audit', action, entity_type, metadata->>'inserted', metadata->>'updated' from public.audit_log order by id;
rollback;
