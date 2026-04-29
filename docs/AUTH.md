# AUTH

## JWT structure

```text
auth.jwt()
  └─ claims
      ├─ sub
      ├─ email
      ├─ role
      ├─ app_metadata
      │   ├─ school_id
      │   └─ role
      └─ user_metadata
```

## School ID flow

`profiles.school_id` -> custom access token hook -> `jwt.app_metadata.school_id` -> request context / RLS checks.

## Role flow

`profiles.role` -> custom access token hook -> `jwt.app_metadata.role` -> request context / app-level authorization.

## Notes

The top-level JWT `role` claim remains the Supabase auth role required by the platform. The school-specific role is carried in `app_metadata.role` to avoid clashing with the required claim.
