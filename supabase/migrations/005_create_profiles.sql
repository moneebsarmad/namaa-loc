create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  email text,
  role text,
  assigned_house text,
  linked_student_id uuid,
  linked_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_school_role_house
  on public.profiles (school_id, role, assigned_house);

create index if not exists idx_profiles_school_email
  on public.profiles (school_id, email);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
