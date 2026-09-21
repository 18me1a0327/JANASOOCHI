-- Qualify voter_records.verification_status so it cannot collide with the
-- table-return output parameter of the same name in PL/pgSQL.
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

  update public.voter_records as voter
  set corrected_value = p_corrected_value,
      corrected_by = v_actor,
      corrected_at = v_now,
      verification_status = case
        when p_mark_verified then 'verified'::public.verification_status
        else voter.verification_status
      end,
      verified_by = case when p_mark_verified then v_actor else voter.verified_by end,
      verified_at = case when p_mark_verified then v_now else voter.verified_at end,
      updated_at = v_now
  where voter.id = v_voter.id;

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
    case
      when p_mark_verified then 'verified'::public.verification_status
      else v_voter.verification_status
    end,
    v_now;
end;
$$;

comment on function public.save_review_correction_v1(bigint, jsonb, boolean, text) is
  'Atomically preserves a correction, updates the source record, optionally resolves one Review issue, and writes an audit event.';

revoke all on function public.save_review_correction_v1(bigint, jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.save_review_correction_v1(bigint, jsonb, boolean, text)
  to authenticated;
