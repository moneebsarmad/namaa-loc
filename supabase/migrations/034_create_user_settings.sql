create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_user_settings_user_id
  on public.user_settings (user_id);

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
