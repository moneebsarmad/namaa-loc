create table if not exists public.roles (
  role_name text primary key,
  description text not null,
  priority integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (role_name, description, priority) values
  ('super_admin', 'Full platform control across all schools and configuration', 1),
  ('school_admin', 'School-scoped admin for users, settings, reports, and operations', 2),
  ('dean', 'School-scoped academic and discipline leadership with broad visibility', 3),
  ('teacher', 'Classroom-facing staff who can award or deduct points and view assigned students', 4),
  ('support_staff', 'Limited operational staff who can record points and see basic student data', 5),
  ('house_mentor', 'House-scoped staff who manage one assigned house', 6),
  ('parent', 'Parent portal access limited to linked children', 7),
  ('student', 'Student portal access limited to the student's own record', 8)
on conflict (role_name) do update
set
  description = excluded.description,
  priority = excluded.priority,
  updated_at = now();

create or replace function public.set_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_set_roles_updated_at on public.roles;
create trigger trigger_set_roles_updated_at
before update on public.roles
for each row
execute function public.set_roles_updated_at();
