create or replace view public.grade_section_totals_view as
with school_ctx as (
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid as school_id
)
select
  s.school_id,
  s.grade,
  s.section,
  coalesce(sum(ml.points), 0)::bigint as total_points,
  count(distinct s.student_id)::bigint as student_count,
  count(ml.id)::bigint as merit_count
from public.students s
join school_ctx sc
  on sc.school_id = s.school_id
left join public.merit_log ml
  on ml.school_id = s.school_id
 and ml.student_id = s.student_id
group by
  s.school_id,
  s.grade,
  s.section;

grant select on public.grade_section_totals_view to authenticated, service_role;

