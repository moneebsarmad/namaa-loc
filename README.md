# namaa-loc

`namaa-loc` is the multi-tenant League of Champions (LOC) SaaS monorepo built by Namaa for Islamic schools, with separate Next.js apps for the portal, leaderboard, and admin surfaces plus shared packages for UI, Supabase/database access, and configuration.

## Dev setup

1. Install Node.js 20 or 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the required values.
4. Run `npm run dev` to start all apps through Turborepo.

Single-app dev commands are available through npm workspaces, for example `npm run dev --workspace @namaa-loc/portal`.
