create table if not exists public.level_b_interventions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  staff_id uuid references auth.users(id),
  staff_name text not null,
  domain_id integer references public.behavioral_domains(id),
  escalation_trigger text not null check (escalation_trigger in (
    'demerit_assigned',
    '3rd_incident_10days',
    'ignored_2plus_prompts',
    'peer_impact',
    'space_disruption',
    'safety_risk',
    'threshold_10_points'
  )),
  b1_regulate_completed boolean default false,
  b1_regulate_notes text,
  b2_pattern_naming_completed boolean default false,
  b2_pattern_notes text,
  b3_reflection_completed boolean default false,
  b3_reflection_prompts_used jsonb default '[]'::jsonb,
  b4_repair_completed boolean default false,
  b4_repair_action_selected text,
  b5_replacement_completed boolean default false,
  b5_replacement_skill_practiced text,
  b6_reset_goal_completed boolean default false,
  b6_reset_goal text,
  b6_reset_goal_timeline_days integer check (b6_reset_goal_timeline_days between 1 and 3),
  b7_documentation_completed boolean default false,
  monitoring_start_date date,
  monitoring_end_date date,
  monitoring_method text check (monitoring_method in ('checklist', 'verbal_check', 'written_log')),
  daily_success_rates jsonb default '{}'::jsonb,
  final_success_rate decimal(5,2),
  status text default 'in_progress' check (status in (
    'in_progress',
    'monitoring',
    'completed_success',
    'completed_escalated',
    'cancelled'
  )),
  escalated_to_c boolean default false,
  escalation_reason text,
  escalated_from_level_a_id uuid references public.level_a_interventions(id),
  conference_timestamp timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_level_b_school_student
  on public.level_b_interventions (school_id, student_id);

create index if not exists idx_level_b_school_status
  on public.level_b_interventions (school_id, status);

create index if not exists idx_level_b_school_domain
  on public.level_b_interventions (school_id, domain_id);

create index if not exists idx_level_b_school_monitoring
  on public.level_b_interventions (school_id, monitoring_end_date)
  where status in ('in_progress', 'monitoring');

create index if not exists idx_level_b_school_created
  on public.level_b_interventions (school_id, created_at desc);

create trigger set_level_b_interventions_updated_at
before update on public.level_b_interventions
for each row
execute function public.set_updated_at();

