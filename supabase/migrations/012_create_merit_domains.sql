create table if not exists public.merit_domains (
  id serial primary key,
  domain_key text not null unique,
  domain_name text not null,
  display_name text not null,
  description text,
  color text not null default '#2D5016',
  display_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger set_merit_domains_updated_at
before update on public.merit_domains
for each row
execute function public.set_updated_at();

insert into public.merit_domains (
  domain_key,
  domain_name,
  display_name,
  description,
  color,
  display_order
)
values
  ('prayer_space', 'Prayer Space', 'Prayer Space', 'Salah, wudu, masjid adab, spiritual moments', '#2D5016', 1),
  ('hallways', 'Hallways/Transitions', 'Hallways', 'Walking, transitions, movement between classes', '#1e40af', 2),
  ('lunch_recess', 'Lunch/Recess', 'Lunch/Recess', 'Cafeteria, playground, unstructured time', '#B8860B', 3),
  ('washroom', 'Washroom', 'Washrooms', 'Bathroom etiquette, cleanliness, wudu area', '#0d9488', 4),
  ('classroom', 'Classroom & Learning', 'Classrooms', 'Academic behavior, learning engagement, participation', '#7c3aed', 5)
on conflict (domain_key) do update set
  domain_name = excluded.domain_name,
  display_name = excluded.display_name,
  description = excluded.description,
  color = excluded.color,
  display_order = excluded.display_order;
