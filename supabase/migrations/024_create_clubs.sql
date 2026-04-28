do $$
begin
  create type public.club_type_enum as enum ('century_club', 'badr_club', 'fath_club');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  club_type public.club_type_enum not null,
  student_id uuid not null references public.students(student_id) on delete cascade,
  student_name text not null,
  grade integer,
  section text,
  house text,
  points integer not null,
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, club_type, student_id)
);

create index if not exists idx_clubs_school_type_points
  on public.clubs (school_id, club_type, points desc);

create index if not exists idx_clubs_school_student
  on public.clubs (school_id, student_id);

create index if not exists idx_clubs_school_achieved
  on public.clubs (school_id, achieved_at desc);

create trigger set_clubs_updated_at
before update on public.clubs
for each row
execute function public.set_updated_at();

create or replace view public.century_club as
select *
from public.clubs
where club_type = 'century_club';

create or replace view public.badr_club as
select *
from public.clubs
where club_type = 'badr_club';

create or replace view public.fath_club as
select *
from public.clubs
where club_type = 'fath_club';

grant select on public.century_club to anon, authenticated, service_role;
grant select on public.badr_club to anon, authenticated, service_role;
grant select on public.fath_club to anon, authenticated, service_role;

