create or replace view public.student_points_by_r_view as
with school_ctx as (
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid as school_id
)
select
  ml.school_id,
  ml.student_id,
  s.student_name,
  s.grade,
  s.section,
  s.house,
  ml.r,
  sum(ml.points)::bigint as total_points,
  count(ml.id)::bigint as merit_count,
  max(ml.timestamp) as last_awarded_at
from public.merit_log ml
join school_ctx sc
  on sc.school_id = ml.school_id
join public.students s
  on s.school_id = ml.school_id
 and s.student_id = ml.student_id
where coalesce(trim(ml.r), '') <> ''
group by
  ml.school_id,
  ml.student_id,
  s.student_name,
  s.grade,
  s.section,
  s.house,
  ml.r;

grant select on public.student_points_by_r_view to authenticated, service_role;

