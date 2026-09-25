-- Read-only canonical voter analytics for Data Insights.
-- Source-language editions never become additional people: every demographic
-- row starts from one active expected logical_voter and its canonical source.

create or replace function public.get_voter_insights_v1(
  p_part integer default null,
  p_gender text default null,
  p_age_group text default null
)
returns table (
  expected_total bigint,
  available_total bigint,
  male_total bigint,
  female_total bigint,
  other_total bigint,
  unknown_gender_total bigint,
  valid_age_count bigint,
  missing_age_count bigint,
  invalid_age_count bigint,
  average_age numeric,
  median_age numeric,
  youngest_age integer,
  oldest_age integer,
  house_group_count bigint,
  single_house_groups bigint,
  two_house_groups bigint,
  three_four_house_groups bigint,
  five_six_house_groups bigint,
  seven_plus_house_groups bigint,
  largest_house_group bigint,
  average_voters_per_house numeric,
  verified_total bigint,
  needs_review_total bigint,
  unverified_total bigint,
  critical_issue_count bigint,
  duplicate_epic_groups bigint,
  missing_gender_count bigint,
  missing_house_count bigint,
  missing_epic_count bigint,
  missing_serial_count bigint,
  unexpected_serial_count bigint,
  duplicate_part_serial_groups bigint,
  parts jsonb,
  age_groups jsonb,
  house_groups jsonb,
  revision_count bigint
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
    where p_part is null or e.part_number = p_part
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
$$;

comment on function public.get_voter_insights_v1(integer, text, text) is
  'Admin-only aggregate voter demographics for the current canonical revision. One logical voter contributes at most once; source-language copies never increase population counts.';

revoke all on function public.get_voter_insights_v1(integer, text, text)
  from public, anon;
grant execute on function public.get_voter_insights_v1(integer, text, text)
  to authenticated;

