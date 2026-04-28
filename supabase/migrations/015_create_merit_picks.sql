create table if not exists public.merit_picks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  r text not null,
  subcategory text not null,
  points integer not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merit_picks_school_sort
  on public.merit_picks (school_id, sort_order);

create index if not exists idx_merit_picks_school_r
  on public.merit_picks (school_id, r);

create index if not exists idx_merit_picks_school_active
  on public.merit_picks (school_id, is_active);

create trigger set_merit_picks_updated_at
before update on public.merit_picks
for each row
execute function public.set_updated_at();

