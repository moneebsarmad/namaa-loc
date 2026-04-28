create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_id uuid not null references public.parents(parent_id) on delete cascade,
  student_id uuid not null references public.students(student_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, parent_id, student_id)
);

create index if not exists idx_parent_students_school_parent
  on public.parent_students (school_id, parent_id);

create index if not exists idx_parent_students_school_student
  on public.parent_students (school_id, student_id);

create trigger set_parent_students_updated_at
before update on public.parent_students
for each row
execute function public.set_updated_at();
