create or replace view public.grade_champions as
with current_month_points as (
  select
    ml.school_id,
    ml.grade,
    coalesce(ml.section, '') as section,
    sum(ml.points)::bigint as total_points
  from public.merit_log ml
  where ml.date_of_event >= date_trunc('month', current_date)::date
    and ml.date_of_event < (date_trunc('month', current_date) + interval '1 month')::date
  group by ml.school_id, ml.grade, coalesce(ml.section, '')
),
ranked as (
  select
    school_id,
    grade,
    section,
    total_points,
    row_number() over (
      partition by school_id, grade
      order by total_points desc, section asc
    ) as rank
  from current_month_points
)
select
  school_id,
  grade,
  section,
  total_points
from ranked
where rank = 1;

grant select on public.grade_champions to authenticated, service_role;
