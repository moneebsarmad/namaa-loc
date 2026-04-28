create table if not exists public.merit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  student_name text not null,
  grade integer,
  section text,
  house text,
  r text not null,
  subcategory text not null,
  points integer not null,
  notes text,
  staff_id uuid,
  staff_name text not null,
  domain_id integer references public.merit_domains(id),
  date_of_event date not null,
  timestamp timestamptz not null default now()
);

create index if not exists idx_merit_log_school_student_timestamp
  on public.merit_log (school_id, student_id, timestamp desc);

create index if not exists idx_merit_log_school_date
  on public.merit_log (school_id, date_of_event desc);

create index if not exists idx_merit_log_school_house_timestamp
  on public.merit_log (school_id, house, timestamp desc);

create index if not exists idx_merit_log_school_staff_timestamp
  on public.merit_log (school_id, staff_name, timestamp desc);

create index if not exists idx_merit_log_school_domain
  on public.merit_log (school_id, domain_id);
