create table if not exists public.valid_school_days (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  d date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, d)
);

create index if not exists idx_valid_school_days_school_d
  on public.valid_school_days (school_id, d);

create trigger set_valid_school_days_updated_at
before update on public.valid_school_days
for each row
execute function public.set_updated_at();

grant select on public.valid_school_days to authenticated, service_role;
grant all on public.valid_school_days to service_role;
