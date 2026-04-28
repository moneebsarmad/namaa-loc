create table if not exists public.behavioral_domains (
  id serial primary key,
  domain_key text not null unique,
  domain_name text not null,
  description text,
  expectations jsonb default '[]'::jsonb,
  repair_menu_immediate jsonb default '[]'::jsonb,
  repair_menu_restorative jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger set_behavioral_domains_updated_at
before update on public.behavioral_domains
for each row
execute function public.set_updated_at();

insert into public.behavioral_domains (
  domain_key,
  domain_name,
  description,
  expectations,
  repair_menu_immediate,
  repair_menu_restorative
)
values
  (
    'prayer_space',
    'Prayer Space (Salah & Transitions)',
    'Sacred space respect, wudu preparation, stillness during prayer, proper entry/exit',
    '["Maintain wudu properly", "Enter prayer space with adab", "Maintain stillness during salah", "Respectful entry and exit transitions"]'::jsonb,
    '["Redo entry with adab", "Silent line reset", "Apologize to affected peers", "Reset disrupted space"]'::jsonb,
    '["Write reflection on salah adab", "Help set up prayer space for next salah", "Staff commitment meeting"]'::jsonb
  ),
  (
    'hallways',
    'Hallways & Transitions',
    'Right-side flow, quiet voices, hands-to-self, respectful spacing',
    '["Walk on right side", "Use quiet voices", "Keep hands to self", "Maintain respectful spacing"]'::jsonb,
    '["Redo transition silently", "Flow correction practice", "Apologize for crowding or disruption"]'::jsonb,
    '["Greeting culture repair activity", "Reflection note on safety risks", "Hallway monitor helper duty"]'::jsonb
  ),
  (
    'lunch_recess',
    'Lunch/Recess & Unstructured Time',
    'Inclusion behaviors, environmental care, conflict resolution',
    '["Include others in activities", "Care for shared space and environment", "Resolve conflicts peacefully", "Follow adult directions promptly"]'::jsonb,
    '["Clean area fully", "Specific peer apology", "Supervised inclusion invitation to peer"]'::jsonb,
    '["Service repair (table/chair reset duty)", "Conflict replay writing exercise", "Lunch helper duty for week"]'::jsonb
  ),
  (
    'respect',
    'Respect & Community',
    'Appropriate speech, authority relationships, peer interactions, disagreement with dignity',
    '["Use appropriate and respectful language", "Respect authority figures", "Treat peers with kindness", "Disagree with dignity and respect"]'::jsonb,
    '["4-step apology format", "Public correction of public disrespect", "Private reflection time"]'::jsonb,
    '["72-hour respect contract", "Community service activity", "Restorative circle participation"]'::jsonb
  )
on conflict (domain_key) do update set
  domain_name = excluded.domain_name,
  description = excluded.description,
  expectations = excluded.expectations,
  repair_menu_immediate = excluded.repair_menu_immediate,
  repair_menu_restorative = excluded.repair_menu_restorative;
