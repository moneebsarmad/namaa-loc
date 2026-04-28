create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  email text not null,
  auth_uid uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, email)
);

create index if not exists idx_admins_school_email
  on public.admins (school_id, email);

create index if not exists idx_admins_school_auth_uid
  on public.admins (school_id, auth_uid);

create trigger set_admins_updated_at
before update on public.admins
for each row
execute function public.set_updated_at();

grant select on public.admins to authenticated, service_role;
grant all on public.admins to service_role;
