-- Verification without a data correction is a distinct audited operation.
create or replace function public.verify_review_issue_v1(p_issue_id bigint)
returns table (
  issue_id bigint,
  voter_id uuid,
  issue_status text,
  verification_status public.verification_status,
  verified_at timestamptz
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
  v_values jsonb;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select i.* into v_issue
  from public.review_issues i
  where i.id = p_issue_id
  for update;
  if not found then raise exception 'Review issue was not found'; end if;
  if v_issue.status <> 'open' then raise exception 'Only an open Review issue can be verified'; end if;
  if v_issue.voter_id is null then raise exception 'This page-level issue has no voter record to verify'; end if;

  select v.* into v_voter
  from public.voter_records v
  where v.id = v_issue.voter_id
  for update;
  if not found then raise exception 'The source voter record was not found'; end if;

  v_values := coalesce(v_voter.corrected_value, jsonb_build_object(
    'original_name', v_voter.original_name,
    'original_relation_name', v_voter.original_relation_name,
    'original_house_number', v_voter.original_house_number,
    'age', v_voter.age,
    'gender', v_voter.gender,
    'epic_number', v_voter.epic_number
  ));

  update public.voter_records
  set verification_status = 'verified'::public.verification_status,
      verified_by = v_actor,
      verified_at = v_now,
      updated_at = v_now
  where id = v_voter.id;

  update public.review_issues
  set status = 'resolved',
      resolved_by = v_actor,
      resolved_at = v_now,
      resolution_type = 'human_verified',
      resolution_reason = 'Verified against source without data correction',
      original_values = jsonb_build_object(
        'original_name', v_voter.original_name,
        'original_relation_name', v_voter.original_relation_name,
        'original_house_number', v_voter.original_house_number,
        'age', v_voter.age,
        'gender', v_voter.gender,
        'epic_number', v_voter.epic_number
      ),
      resulting_values = v_values,
      updated_at = v_now
  where id = v_issue.id;

  insert into public.audit_log(action, actor_id, entity_type, entity_id, metadata, operation_status)
  values (
    'review_verified_without_correction', v_actor, 'review_issue', p_issue_id::text,
    jsonb_build_object('voter_id', v_voter.id, 'part_number', v_voter.part_number,
      'pdf_page_number', v_voter.pdf_page_number), 'succeeded'
  );

  return query select v_issue.id, v_voter.id, 'resolved'::text,
    'verified'::public.verification_status, v_now;
end;
$$;

comment on function public.verify_review_issue_v1(bigint) is
  'Atomically verifies an unchanged voter against its source and resolves one Review issue without creating a correction.';
revoke all on function public.verify_review_issue_v1(bigint) from public, anon, authenticated;
grant execute on function public.verify_review_issue_v1(bigint) to authenticated;

