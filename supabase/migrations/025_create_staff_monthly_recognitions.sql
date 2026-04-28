do $$
begin
  create type public.recognition_type_enum as enum (
    'house_spirit',
    '3r_all_star',
    'steady_hand',
    'diamond_finder',
    'house_champion'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.staff_monthly_recognitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  recognition_type public.recognition_type_enum not null,
  month_key text not null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  staff_name text not null,
  house text,
  grade_assignment text,
  staff_count integer,
  participating_staff integer,
  categories integer,
  r_diversity integer,
  active_days integer,
  awards integer,
  students integer,
  unique_students integer,
  total_points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, recognition_type, month_key, staff_id)
);

create index if not exists idx_staff_monthly_recognitions_school_type_month
  on public.staff_monthly_recognitions (school_id, recognition_type, month_key);

create index if not exists idx_staff_monthly_recognitions_school_staff
  on public.staff_monthly_recognitions (school_id, staff_id);

create index if not exists idx_staff_monthly_recognitions_school_house
  on public.staff_monthly_recognitions (school_id, house);

create trigger set_staff_monthly_recognitions_updated_at
before update on public.staff_monthly_recognitions
for each row
execute function public.set_updated_at();

create or replace view public.staff_house_spirit_monthly as
select *
from public.staff_monthly_recognitions
where recognition_type = 'house_spirit';

create or replace view public.staff_3r_all_star_monthly as
select *
from public.staff_monthly_recognitions
where recognition_type = '3r_all_star';

create or replace view public.staff_steady_hand_monthly as
select *
from public.staff_monthly_recognitions
where recognition_type = 'steady_hand';

create or replace view public.staff_diamond_finder_monthly as
select *
from public.staff_monthly_recognitions
where recognition_type = 'diamond_finder';

create or replace view public.staff_house_champion_monthly as
select *
from public.staff_monthly_recognitions
where recognition_type = 'house_champion';

grant select on public.staff_house_spirit_monthly to authenticated, service_role;
grant select on public.staff_3r_all_star_monthly to authenticated, service_role;
grant select on public.staff_steady_hand_monthly to authenticated, service_role;
grant select on public.staff_diamond_finder_monthly to authenticated, service_role;
grant select on public.staff_house_champion_monthly to authenticated, service_role;

