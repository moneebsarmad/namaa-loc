create or replace view public.merit_log_parent as
select
  ml.id,
  ml.school_id,
  ml.student_id,
  ml.student_name,
  ml.grade,
  ml.section,
  ml.house,
  ml.r,
  ml.subcategory,
  ml.points,
  ml.date_of_event,
  ml.timestamp
from public.merit_log ml
where exists (
  select 1
  from public.parent_students ps
  where ps.parent_id = auth.uid()
    and ps.student_id = ml.student_id
    and ps.school_id = ml.school_id
)
and ml.school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid;

grant select on public.merit_log_parent to authenticated;
