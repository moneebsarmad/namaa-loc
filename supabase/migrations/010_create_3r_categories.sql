create table if not exists public."3r_categories" (
  id serial primary key,
  r text not null,
  subcategory text not null,
  points integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_3r_categories_updated_at
before update on public."3r_categories"
for each row
execute function public.set_updated_at();

insert into public."3r_categories" (r, subcategory, points) values
  ('Respect', 'Polite Language & Manners', 5),
  ('Respect', 'Helping Others', 10),
  ('Respect', 'Inclusion', 10),
  ('Respect', 'Conflict Resolution', 20),
  ('Respect', 'Standing Up for Others', 50),
  ('Respect', 'Other (please specify)', 10),
  ('Responsibility', 'Personal Accountability', 5),
  ('Responsibility', 'Cleanliness & Care', 10),
  ('Responsibility', 'Proactive Help', 10),
  ('Responsibility', 'Self-Discipline', 20),
  ('Responsibility', 'Other (please specify)', 10),
  ('Righteousness', 'Prayer Etiquette', 10),
  ('Righteousness', 'Avoiding Harm', 20),
  ('Righteousness', 'Generosity of Spirit', 20),
  ('Righteousness', 'Controlling the Nafs', 20),
  ('Righteousness', 'Other (please specify)', 10);
