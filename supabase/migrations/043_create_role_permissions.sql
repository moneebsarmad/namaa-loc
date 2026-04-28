create table if not exists public.role_permissions (
  role_name text not null references public.roles(role_name) on delete cascade,
  permission_name text not null references public.permissions(permission_name) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (role_name, permission_name)
);

create index if not exists idx_role_permissions_role_name
  on public.role_permissions(role_name);

create index if not exists idx_role_permissions_permission_name
  on public.role_permissions(permission_name);

insert into public.role_permissions (role_name, permission_name) values
  ('super_admin', 'award_points'),
  ('super_admin', 'deduct_points'),
  ('super_admin', 'view_all_students'),
  ('super_admin', 'view_house_students'),
  ('super_admin', 'view_own_record'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'manage_school_settings'),
  ('super_admin', 'manage_interventions'),
  ('super_admin', 'view_reports'),
  ('super_admin', 'export_reports'),
  ('super_admin', 'view_audit_logs'),
  ('super_admin', 'manage_roles'),
  ('super_admin', 'manage_houses'),
  ('super_admin', 'manage_staff'),

  ('school_admin', 'award_points'),
  ('school_admin', 'deduct_points'),
  ('school_admin', 'view_all_students'),
  ('school_admin', 'view_house_students'),
  ('school_admin', 'manage_users'),
  ('school_admin', 'manage_school_settings'),
  ('school_admin', 'manage_interventions'),
  ('school_admin', 'view_reports'),
  ('school_admin', 'export_reports'),
  ('school_admin', 'view_audit_logs'),
  ('school_admin', 'manage_houses'),
  ('school_admin', 'manage_staff'),

  ('dean', 'award_points'),
  ('dean', 'deduct_points'),
  ('dean', 'view_all_students'),
  ('dean', 'view_house_students'),
  ('dean', 'manage_users'),
  ('dean', 'manage_interventions'),
  ('dean', 'view_reports'),
  ('dean', 'export_reports'),
  ('dean', 'manage_houses'),

  ('teacher', 'award_points'),
  ('teacher', 'deduct_points'),
  ('teacher', 'view_all_students'),
  ('teacher', 'view_house_students'),
  ('teacher', 'view_own_record'),
  ('teacher', 'view_reports'),

  ('support_staff', 'award_points'),
  ('support_staff', 'deduct_points'),
  ('support_staff', 'view_house_students'),
  ('support_staff', 'view_own_record'),

  ('house_mentor', 'award_points'),
  ('house_mentor', 'deduct_points'),
  ('house_mentor', 'view_house_students'),
  ('house_mentor', 'view_reports'),
  ('house_mentor', 'export_reports'),

  ('parent', 'view_own_record'),

  ('student', 'view_own_record')
on conflict (role_name, permission_name) do nothing;
