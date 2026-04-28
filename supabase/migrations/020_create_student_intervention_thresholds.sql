create table if not exists public.student_intervention_thresholds (
  id serial primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  threshold_name text not null,
  description text,
  demerit_points integer not null,
  intervention_level text not null check (intervention_level in (
    'level_b',
    'level_c_lite',
    'level_c',
    'level_c_reentry',
    'admin_decision'
  )),
  intervention_duration_days integer,
  additional_supports jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (school_id, threshold_name)
);

create index if not exists idx_student_intervention_thresholds_school_level
  on public.student_intervention_thresholds (school_id, intervention_level);

create index if not exists idx_student_intervention_thresholds_school_created
  on public.student_intervention_thresholds (school_id, created_at desc);

