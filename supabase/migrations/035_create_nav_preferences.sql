create table if not exists public.nav_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collapsed_sections jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_nav_preferences_user_id
  on public.nav_preferences (user_id);

create trigger set_nav_preferences_updated_at
before update on public.nav_preferences
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.nav_preferences to authenticated;
grant all on public.nav_preferences to service_role;
