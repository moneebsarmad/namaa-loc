create table if not exists public.level_c_cases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  case_manager_id uuid references auth.users(id),
  case_manager_name text,
  trigger_type text not null check (trigger_type in (
    'safety_incident',
    'no_improvement_2_level_b',
    'chronic_pattern',
    'post_oss_reentry',
    'threshold_20_points',
    'threshold_30_points',
    'threshold_35_points',
    'threshold_40_points',
    'admin_referral'
  )),
  case_type text default 'standard' check (case_type in ('standard', 'lite', 'intensive')),
  domain_focus_id integer references public.behavioral_domains(id),
  incident_summary text,
  pattern_review text,
  environmental_factors jsonb default '[]'::jsonb,
  prior_interventions_summary text,
  context_packet_completed boolean default false,
  admin_response_type text check (admin_response_type in (
    'detention',
    'iss',
    'oss',
    'behavior_contract',
    'parent_conference',
    'other'
  )),
  admin_response_details text,
  consequence_start_date date,
  consequence_end_date date,
  admin_response_completed boolean default false,
  support_plan_goal text,
  support_plan_strategies jsonb default '[]'::jsonb,
  adult_mentor_id uuid references auth.users(id),
  adult_mentor_name text,
  repair_actions jsonb default '[]'::jsonb,
  reentry_date date,
  reentry_type text default 'standard' check (reentry_type in ('standard', 'restricted')),
  reentry_restrictions jsonb default '[]'::jsonb,
  reentry_checklist jsonb default '[]'::jsonb,
  reentry_planning_completed boolean default false,
  monitoring_duration_days integer default 10,
  monitoring_schedule jsonb default '[]'::jsonb,
  review_dates jsonb default '[]'::jsonb,
  daily_check_ins jsonb default '[]'::jsonb,
  closure_criteria text,
  closure_date date,
  outcome_status text check (outcome_status in (
    'closed_success',
    'closed_continued_support',
    'closed_escalated',
    'active'
  )),
  outcome_notes text,
  escalated_from_level_b_ids uuid[] default '{}',
  sis_demerit_points_at_creation integer,
  status text default 'active' check (status in (
    'active',
    'context_packet',
    'admin_response',
    'pending_reentry',
    'monitoring',
    'closed'
  )),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_level_c_school_student
  on public.level_c_cases (school_id, student_id);

create index if not exists idx_level_c_school_status
  on public.level_c_cases (school_id, status);

create index if not exists idx_level_c_school_case_manager
  on public.level_c_cases (school_id, case_manager_id);

create index if not exists idx_level_c_school_reentry
  on public.level_c_cases (school_id, reentry_date)
  where status = 'pending_reentry';

create index if not exists idx_level_c_school_created
  on public.level_c_cases (school_id, created_at desc);

create trigger set_level_c_cases_updated_at
before update on public.level_c_cases
for each row
execute function public.set_updated_at();

