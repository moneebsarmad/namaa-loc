create table public.houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  display_name text not null,
  value text,
  description text,
  color text,
  icon_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index houses_school_id_sort_order_idx on public.houses (school_id, sort_order);

create trigger set_houses_updated_at
before update on public.houses
for each row
execute function public.set_updated_at();
