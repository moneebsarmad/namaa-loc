create or replace view public.merit_log_parent as
select
  id,
  student_id,
  student_name,
  grade,
  section,
  house,
  r,
  subcategory,
  points,
  date_of_event,
  timestamp
from public.merit_log
where exists (
  select 1
  from public.parent_students ps
  where ps.parent_id = auth.uid()
    and ps.student_id = public.merit_log.student_id
);

grant select on public.merit_log_parent to authenticated;

