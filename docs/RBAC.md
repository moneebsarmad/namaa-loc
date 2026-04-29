# RBAC

## Final Roles

- `super_admin`: full platform control across all schools and configuration.
- `school_admin`: school-scoped admin for users, settings, reports, and operations.
- `dean`: school-scoped academic and discipline leadership with broad visibility.
- `teacher`: classroom-facing staff who can award or deduct points and view assigned students.
- `support_staff`: limited operational staff who can record points and see basic student data.
- `house_mentor`: house-scoped staff who manage one assigned house.
- `parent`: portal access limited to linked children.
- `student`: portal access limited to the student's own record.

## Permissions

- `award_points`
- `deduct_points`
- `view_all_students`
- `view_house_students`
- `view_own_record`
- `manage_users`
- `manage_school_settings`
- `manage_interventions`
- `view_reports`
- `export_reports`
- `view_audit_logs`
- `manage_roles`
- `manage_houses`
- `manage_staff`

## Role Drift Note

The old LOC repo drifted from `admin` to `school_admin`-style behavior, then later added `parent` and `student` without a clean canonical role set. This migration set resolves that by defining one final role registry and a separate permission layer that can be extended without reworking the core roles.
