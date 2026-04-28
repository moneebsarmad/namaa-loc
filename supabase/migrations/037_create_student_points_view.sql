create or replace view public.student_points_view as
with school_ctx as (
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid as school_id
)
select
  s.school_id,
  s.student_id,
  s.student_name,
  s.grade,
  s.section,
  s.house,
  coalesce(sum(ml.points), 0)::bigint as total_points,
  count(ml.id)::bigint as merit_count,
  max(ml.timestamp) as last_awarded_at
from public.students s
join school_ctx sc
  on sc.school_id = s.school_id
left join public.merit_log ml
  on ml.school_id = s.school_id
 and ml.student_id = s.student_id
group by
  s.school_id,
  s.student_id,
  s.student_name,
  s.grade,
  s.section,
  s.house;

grant select on public.student_points_view to authenticated, service_role;

