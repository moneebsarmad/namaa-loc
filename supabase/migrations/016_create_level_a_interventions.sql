create table if not exists public.level_a_interventions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  staff_id uuid references auth.users(id),
  staff_name text not null,
  domain_id integer references public.behavioral_domains(id),
  intervention_type text not null check (intervention_type in (
    'pre_correct',
    'positive_narration',
    'quick_redirect',
    'redo',
    'choice_consequence',
    'private_check',
    'micro_repair',
    'quick_reinforcement'
  )),
  behavior_description text,
  location text,
  outcome text not null default 'complied' check (outcome in ('complied', 'escalated', 'partial')),
  escalated_to_b boolean default false,
  is_repeated_same_day boolean default false,
  affected_others boolean default false,
  is_pattern_student boolean default false,
  event_timestamp timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_level_a_school_student
  on public.level_a_interventions (school_id, student_id);

create index if not exists idx_level_a_school_domain
  on public.level_a_interventions (school_id, domain_id);

create index if not exists idx_level_a_school_staff
  on public.level_a_interventions (school_id, staff_id);

create index if not exists idx_level_a_school_timestamp
  on public.level_a_interventions (school_id, event_timestamp desc);

create index if not exists idx_level_a_school_escalated
  on public.level_a_interventions (school_id, escalated_to_b)
  where escalated_to_b = true;

