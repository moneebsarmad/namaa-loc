create table if not exists public.student_invite_codes (
  student_id uuid primary key references public.students(student_id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_invite_codes_school_created
  on public.student_invite_codes (school_id, created_at desc);

create index if not exists idx_student_invite_codes_school_active
  on public.student_invite_codes (school_id, active);

create trigger set_student_invite_codes_updated_at
before update on public.student_invite_codes
for each row
execute function public.set_updated_at();

grant select on public.student_invite_codes to authenticated;
grant all on public.student_invite_codes to service_role;
