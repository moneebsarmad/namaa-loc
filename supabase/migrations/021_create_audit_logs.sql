create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_school_created_idx
  on public.audit_log (school_id, created_at desc);

create index if not exists audit_log_school_actor_idx
  on public.audit_log (school_id, actor_user_id, created_at desc);

create index if not exists audit_log_school_action_idx
  on public.audit_log (school_id, action, created_at desc);

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
