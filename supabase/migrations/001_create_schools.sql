create extension if not exists pgcrypto;

create type public.school_status as enum ('draft', 'active', 'paused', 'archived');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status public.school_status not null default 'draft',
  timezone text not null default 'America/Chicago',
  primary_contact_name text,
  primary_contact_email text,
  billing_contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_schools_updated_at
before update on public.schools
for each row
execute function public.set_updated_at();
