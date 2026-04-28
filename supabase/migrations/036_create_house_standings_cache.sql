create table if not exists public.house_standings_cache (
  school_id uuid not null references public.schools(id) on delete cascade,
  house text not null,
  total_points bigint not null,
  computed_at timestamptz not null default now(),
  primary key (school_id, house)
);

create index if not exists idx_house_standings_cache_school_computed
  on public.house_standings_cache (school_id, computed_at desc);

grant select on public.house_standings_cache to anon, authenticated, service_role;
grant all on public.house_standings_cache to service_role;
