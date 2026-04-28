create table if not exists public.weighted_staff_pool (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  month_key text not null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  staff_name text not null,
  house text,
  grade_assignment text,
  department text,
  weighted_score numeric(10,2) not null default 0,
  points integer not null default 0,
  active_days integer not null default 0,
  entries_count integer not null default 0,
  notes_compliance_pct numeric(5,2),
  consistency_pct numeric(5,2),
  rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, month_key, staff_id)
);

create index if not exists idx_weighted_staff_pool_school_month_score
  on public.weighted_staff_pool (school_id, month_key, weighted_score desc);

create index if not exists idx_weighted_staff_pool_school_staff
  on public.weighted_staff_pool (school_id, staff_id);

create trigger set_weighted_staff_pool_updated_at
before update on public.weighted_staff_pool
for each row
execute function public.set_updated_at();

grant select on public.weighted_staff_pool to authenticated, service_role;
grant all on public.weighted_staff_pool to service_role;
