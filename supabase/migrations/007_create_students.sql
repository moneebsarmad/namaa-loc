create table if not exists public.students (
  student_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_name text not null,
  grade integer not null,
  section text,
  house text,
  student_email text,
  parent_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_school_name_grade
  on public.students (school_id, student_name, grade);

create index if not exists idx_students_school_parent_code
  on public.students (school_id, parent_code)
  where parent_code is not null;

create trigger set_students_updated_at
before update on public.students
for each row
execute function public.set_updated_at();
