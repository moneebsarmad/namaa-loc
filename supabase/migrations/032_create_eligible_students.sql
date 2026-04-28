create or replace view public.eligible_students as
with student_totals as (
  select
    ml.school_id,
    ml.student_id,
    ml.student_name,
    ml.grade,
    ml.section,
    ml.house,
    sum(ml.points)::bigint as total_points
  from public.merit_log ml
  group by ml.school_id, ml.student_id, ml.student_name, ml.grade, ml.section, ml.house
)
select
  school_id,
  student_id,
  student_name,
  grade,
  section,
  house,
  total_points,
  (total_points >= 100)::boolean as century_club_eligible,
  (total_points >= 300)::boolean as badr_club_eligible,
  (total_points >= 700)::boolean as fath_club_eligible,
  case
    when total_points < 100 then 'Century Club'
    when total_points < 300 then 'Badr Club'
    when total_points < 700 then 'Fath Club'
    else null
  end as next_milestone,
  case
    when total_points < 100 then (100 - total_points)::integer
    when total_points < 300 then (300 - total_points)::integer
    when total_points < 700 then (700 - total_points)::integer
    else null
  end as points_needed
from student_totals;

grant select on public.eligible_students to authenticated, service_role;
