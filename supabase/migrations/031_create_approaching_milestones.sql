create or replace view public.approaching_milestones as
with thresholds as (
  select * from (
    values
      ('Century Club'::text, 100::integer),
      ('Badr Club'::text, 300::integer),
      ('Fath Club'::text, 700::integer)
  ) as v(tier, tier_points)
),
student_totals as (
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
),
candidate_rows as (
  select
    st.school_id,
    th.tier,
    th.tier_points,
    st.student_id,
    st.student_name,
    st.grade,
    st.section,
    st.house,
    st.total_points,
    (th.tier_points - st.total_points)::integer as points_needed
  from student_totals st
  join thresholds th on st.total_points < th.tier_points
  where st.total_points >= th.tier_points - 20
)
select
  school_id,
  tier,
  tier_points,
  student_id,
  student_name,
  grade,
  section,
  house,
  total_points,
  points_needed
from candidate_rows;

grant select on public.approaching_milestones to authenticated, service_role;
