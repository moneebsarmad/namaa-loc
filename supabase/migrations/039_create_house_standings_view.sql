create or replace view public.house_standings_view as
with school_ctx as (
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid as school_id
)
select
  ml.school_id,
  ml.house,
  ml.house as house_name,
  sum(ml.points)::bigint as total_points,
  count(distinct ml.student_id)::bigint as student_count
from public.merit_log ml
join school_ctx sc
  on sc.school_id = ml.school_id
where coalesce(trim(ml.house), '') <> ''
group by
  ml.school_id,
  ml.house;

grant select on public.house_standings_view to anon, authenticated, service_role;

