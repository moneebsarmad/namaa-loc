create or replace function public.handle_custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_school_id uuid;
  v_role text;
begin
  select p.school_id, p.role
    into v_school_id, v_role
  from public.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  if v_school_id is null then
    raise exception 'custom access token hook requires a profile row with school_id';
  end if;

  if v_role is null then
    raise exception 'custom access token hook requires a profile row with role';
  end if;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  claims := jsonb_set(
    claims,
    '{app_metadata,school_id}',
    to_jsonb(v_school_id::text),
    true
  );

  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(v_role),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.handle_custom_access_token(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.handle_custom_access_token(jsonb) from authenticated, anon, public;
