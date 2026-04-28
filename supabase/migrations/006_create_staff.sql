create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_name text not null,
  email text not null,
  role text,
  house text,
  grade_assignment text,
  grade text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_school_email
  on public.staff (school_id, email);

create index if not exists idx_staff_school_house
  on public.staff (school_id, house);

create trigger set_staff_updated_at
before update on public.staff
for each row
execute function public.set_updated_at();
