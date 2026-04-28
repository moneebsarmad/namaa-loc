create or replace view public.quarterly_badge_leaders as
with quarter_windows as (
  select
    'q1'::text as quarter,
    make_date(extract(year from current_date)::int, 1, 6) as start_date,
    make_date(extract(year from current_date)::int, 3, 6) as end_date
  union all
  select
    'q2'::text as quarter,
    make_date(extract(year from current_date)::int, 3, 9) as start_date,
    make_date(extract(year from current_date)::int, 5, 21) as end_date
),
student_totals as (
  select
    ml.school_id,
    qw.quarter,
    ml.r as category,
    ''::text as gender,
    ml.student_id,
    ml.student_name,
    ml.grade,
    ml.section,
    sum(ml.points)::bigint as total_points
  from public.merit_log ml
  join quarter_windows qw
    on ml.date_of_event between qw.start_date and qw.end_date
  where coalesce(trim(ml.r), '') <> ''
    and ml.student_id is not null
  group by ml.school_id, qw.quarter, ml.r, ml.student_id, ml.student_name, ml.grade, ml.section
),
ranked as (
  select
    school_id,
    quarter,
    category,
    gender,
    student_name,
    grade,
    section,
    total_points,
    row_number() over (
      partition by school_id, quarter, category, gender
      order by total_points desc, student_name asc, student_id asc
    ) as rank
  from student_totals
)
select
  school_id,
  quarter,
  category,
  gender,
  student_name,
  grade,
  section,
  total_points,
  rank
from ranked
where rank = 1;

grant select on public.quarterly_badge_leaders to authenticated, service_role;
