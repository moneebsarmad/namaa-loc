create or replace view public.top_students_per_house as
with student_totals as (
  select
    ml.school_id,
    ml.house,
    ml.student_name,
    ml.student_id,
    sum(ml.points)::bigint as total_points
  from public.merit_log ml
  where coalesce(trim(ml.house), '') <> ''
    and coalesce(trim(ml.student_name), '') <> ''
    and ml.student_id is not null
  group by ml.school_id, ml.house, ml.student_name, ml.student_id
),
ranked_students as (
  select
    school_id,
    house,
    student_name,
    student_id,
    total_points,
    row_number() over (
      partition by school_id, house
      order by total_points desc, student_name asc, student_id asc
    ) as house_rank
  from student_totals
)
select
  school_id,
  house,
  house as house_name,
  student_name,
  student_id,
  total_points,
  house_rank
from ranked_students
where house_rank <= 5;

grant select on public.top_students_per_house to anon, authenticated, service_role;

