create table if not exists public.permissions (
  permission_name text primary key,
  description text not null,
  category text not null,
  created_at timestamptz not null default now()
);

insert into public.permissions (permission_name, description, category) values
  ('award_points', 'Can award merit or house points to students', 'points'),
  ('deduct_points', 'Can deduct merit or house points from students', 'points'),
  ('view_all_students', 'Can view the full student roster across the school', 'students'),
  ('view_house_students', 'Can view students in the assigned house only', 'students'),
  ('view_own_record', 'Can view the current user's own portal record', 'profile'),
  ('manage_users', 'Can create, edit, and deactivate user accounts', 'admin'),
  ('manage_school_settings', 'Can update school-level settings and branding', 'admin'),
  ('manage_interventions', 'Can create and update intervention records', 'interventions'),
  ('view_reports', 'Can view operational and academic reports', 'reports'),
  ('export_reports', 'Can export reports and summaries', 'reports'),
  ('view_audit_logs', 'Can review audit and activity logs', 'audit'),
  ('manage_roles', 'Can assign and change roles and permissions', 'admin'),
  ('manage_houses', 'Can create and edit houses and house metadata', 'houses'),
  ('manage_staff', 'Can manage staff records and staff access', 'admin')
on conflict (permission_name) do update
set
  description = excluded.description,
  category = excluded.category;
