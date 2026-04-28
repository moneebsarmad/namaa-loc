create table public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools (id) on delete cascade,
  program_name text not null default 'League of Champions',
  program_short_name text not null default 'LOC',
  point_label_singular text not null default 'Point',
  point_label_plural text not null default 'Points',
  house_label text not null default 'House',
  leaderboard_label text not null default 'Leaderboard',
  primary_color text not null default '#023020',
  secondary_color text,
  accent_color text,
  logo_url text,
  favicon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_school_settings_updated_at
before update on public.school_settings
for each row
execute function public.set_updated_at();
