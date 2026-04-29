Port the {{FEATURE_NAME}} feature from the LOC repo to namaa-loc.

Source (READ-ONLY): /Users/MoneebSarmad_1/desktop/leagueofchampions

Destination: /Users/MoneebSarmad_1/desktop/namaa-loc

Step 1 — Identify all files involved in this feature in LOC:

- Pages / route handlers

- API endpoints

- Components specific to this feature

- Hooks / utilities specific to this feature

- Types / interfaces specific to this feature

- Any tests

Show me this list FIRST. Don't copy yet.

Step 2 — After I approve the list, copy each file to the equivalent path in namaa-loc.

Step 3 — Make ONLY these surgical modifications:

A) Multi-tenant scoping:

- Every Supabase query that hits a tenant-scoped table: add .eq('school_id', currentSchoolId)

- Get currentSchoolId via the API protection utilities from packages/db/src/auth.ts

- Every API route handler: wrap with withSchoolScope or use getCurrentSchoolId + assertSchoolMatch

B) Replace hardcoded references with config lookups:

- "League of Stars" / "League of Champions" / "LOS" / "LOC" in user-facing UI → use {school_settings.program_name} or {school_settings.program_short_name}

- DAAIS-specific house names → query houses table filtered by school_id

- Hardcoded brand colors (#023020 etc.) → CSS custom properties from school_settings

- DAAIS or Brighter Horizons mentions in user-facing UI → {school_settings.school.name}

- Hardcoded logos → school_settings.logo_url

C) Where there is no school_settings context yet (e.g., login page before school known), use sensible defaults that match LOC.

Step 4 — Do NOT change:

- JSX structure or markup

- Tailwind classes or styling

- Component names

- File structure within feature

- Business logic

- State management patterns

Step 5 — After porting:

- List every file copied (source → destination)

- List every modification made (file + line + before/after)

- List anything you noticed but did NOT change (because it's outside scope)

- Run the relevant page locally and confirm it loads without errors against DAAIS Demo tenant

- Take a screenshot description (since you can't actually screenshot, describe what renders)

Commit message: "feat: port {{FEATURE_NAME}} with multi-tenant scoping"

Stop and wait for me to verify before next feature.
