create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  v_school_id := nullif(new.raw_app_meta_data ->> 'school_id', '')::uuid;

  if v_school_id is null then
    raise exception 'auth.users insert requires raw_app_meta_data.school_id';
  end if;

  insert into public.profiles (
    id,
    school_id,
    email,
    role,
    assigned_house,
    linked_student_id,
    linked_staff_id
  )
  values (
    new.id,
    v_school_id,
    new.email,
    'student',
    null,
    null,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
