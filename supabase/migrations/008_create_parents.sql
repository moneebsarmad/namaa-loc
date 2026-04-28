create table if not exists public.parents (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  relationship text not null check (relationship in ('father', 'mother', 'guardian')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parents_school_email
  on public.parents (school_id, lower(email));

create trigger set_parents_updated_at
before update on public.parents
for each row
execute function public.set_updated_at();
