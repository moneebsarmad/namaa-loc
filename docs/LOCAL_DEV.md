# LOCAL_DEV

## Hosts file

Add these entries with `sudo nano /etc/hosts`:

```text
127.0.0.1 daais-demo.localhost
127.0.0.1 test-school.localhost
127.0.0.1 admin.localhost
```

`/etc/hosts` does not support a true wildcard entry, so add one line per local subdomain you want to test.

## Run all apps

Use the root script:

```bash
npm run dev:all
```

## Ports

- Portal: `3000`
- Leaderboard: `3001`
- Admin: `3002`

## Subdomain access

- `daais-demo.localhost:3000` for the DAAIS demo tenant
- `daais-demo.localhost:3001` for the public leaderboard
- `admin.localhost:3002` for the admin app

## Test users

Create test users in the Supabase Dashboard under Authentication. Make sure the user profile row has the correct `school_id` metadata flow before testing tenant-aware pages.

## Login modes

- Super admin: sign in with a user whose profile role is `super_admin`
- Regular user: sign in with a user whose profile role matches the school-scoped role you want to test
