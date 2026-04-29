do $$
declare
  v_school_id uuid;
begin
  insert into public.schools (
    slug,
    name,
    status,
    timezone
  )
  values (
    'daais-demo',
    'Dar al-Arqam Islamic School (Demo)',
    'active',
    'America/Chicago'
  )
  on conflict (slug) do update
    set name = excluded.name,
        status = excluded.status,
        timezone = excluded.timezone,
        updated_at = now()
  returning id into v_school_id;

  insert into public.school_settings (
    school_id,
    program_name,
    program_short_name,
    point_label_singular,
    point_label_plural,
    house_label,
    leaderboard_label,
    primary_color
  )
  values (
    v_school_id,
    'League of Champions',
    'LOC',
    'Champion Point',
    'Champion Points',
    'House',
    'House Standings',
    '#023020'
  )
  on conflict (school_id) do update
    set program_name = excluded.program_name,
        program_short_name = excluded.program_short_name,
        point_label_singular = excluded.point_label_singular,
        point_label_plural = excluded.point_label_plural,
        house_label = excluded.house_label,
        leaderboard_label = excluded.leaderboard_label,
        primary_color = excluded.primary_color,
        updated_at = now();

  delete from public.houses
  where school_id = v_school_id;

  insert into public.houses (
    school_id,
    name,
    display_name,
    value,
    description,
    color,
    icon_url,
    sort_order,
    is_active
  )
  values
    (
      v_school_id,
      'house_of_abu_bakr',
      'House of Abū Bakr',
      'Loyalty',
      null,
      '#2f0a61',
      '/houses/abu-bakr.png',
      1,
      true
    ),
    (
      v_school_id,
      'house_of_khadijah',
      'House of Khadījah',
      'Wisdom',
      null,
      '#055437',
      '/houses/khadijah.png',
      2,
      true
    ),
    (
      v_school_id,
      'house_of_umar',
      'House of ʿUmar',
      'Moral Courage',
      null,
      '#000068',
      '/houses/umar.png',
      3,
      true
    ),
    (
      v_school_id,
      'house_of_aishah',
      'House of ʿĀʾishah',
      'Creativity',
      null,
      '#910000',
      '/houses/aishah.png',
      4,
      true
    );
end $$;
