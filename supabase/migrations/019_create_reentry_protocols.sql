create table if not exists public.reentry_protocols (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  source_type text not null check (source_type in (
    'level_b',
    'detention',
    'iss',
    'oss'
  )),
  level_b_id uuid references public.level_b_interventions(id),
  level_c_id uuid references public.level_c_cases(id),
  reentry_date date not null,
  reentry_time time,
  receiving_teacher_id uuid references auth.users(id),
  receiving_teacher_name text,
  readiness_checklist jsonb default '[
    {"item": "Student can articulate what happened", "completed": false},
    {"item": "Student can name the expectation broken", "completed": false},
    {"item": "Student has identified repair action", "completed": false},
    {"item": "Student can state reset goal", "completed": false}
  ]'::jsonb,
  readiness_verified_by uuid references auth.users(id),
  readiness_verified_at timestamptz,
  teacher_script text,
  reset_goal_from_intervention text,
  first_behavioral_rep_completed boolean default false,
  monitoring_start_date date,
  monitoring_end_date date,
  monitoring_type text check (monitoring_type in ('3_day', '5_day', '10_day')),
  monitoring_method text check (monitoring_method in ('checklist', 'check_in_out', 'intensive')),
  daily_logs jsonb default '[]'::jsonb,
  outcome text check (outcome in ('success', 'partial', 'escalated')),
  outcome_notes text,
  completed_at timestamptz,
  status text default 'pending' check (status in ('pending', 'ready', 'active', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reentry_school_student
  on public.reentry_protocols (school_id, student_id);

create index if not exists idx_reentry_school_date
  on public.reentry_protocols (school_id, reentry_date);

create index if not exists idx_reentry_school_status
  on public.reentry_protocols (school_id, status);

create trigger set_reentry_protocols_updated_at
before update on public.reentry_protocols
for each row
execute function public.set_updated_at();

