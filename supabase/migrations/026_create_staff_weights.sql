create table if not exists public.staff_weights (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  weight_key text not null,
  weight_label text not null,
  weight_value numeric(10,2) not null default 1,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, weight_key)
);

create index if not exists idx_staff_weights_school_active
  on public.staff_weights (school_id, is_active);

create index if not exists idx_staff_weights_school_key
  on public.staff_weights (school_id, weight_key);

create trigger set_staff_weights_updated_at
before update on public.staff_weights
for each row
execute function public.set_updated_at();

grant select on public.staff_weights to authenticated, service_role;
grant all on public.staff_weights to service_role;
