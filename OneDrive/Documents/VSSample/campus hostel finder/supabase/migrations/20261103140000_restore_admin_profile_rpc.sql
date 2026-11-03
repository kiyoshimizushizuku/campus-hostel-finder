create or replace function public.admin_update_profile_basics(
  target_user_id uuid,
  user_name text,
  contact_no text,
  contact_email text,
  university_id bigint,
  department text,
  bio text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_role text;
  profile_table text;
  profile_payload jsonb;
  assignments text;
  affected_rows bigint;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and to_jsonb(p) ->> 'role' = 'ADMIN'
      and coalesce(to_jsonb(p) ->> 'status', 'active') = 'active'
  ) then
    raise exception 'Active admin access required';
  end if;

  select to_jsonb(p) ->> 'role'
    into target_role
    from public.profiles p
    where p.id = admin_update_profile_basics.target_user_id;

  if target_role is null or target_role not in ('STUDENT', 'LANDLORD') then
    raise exception 'User not found or cannot be changed';
  end if;

  if target_role = 'STUDENT' then
    profile_table := 'student_profiles';
    profile_payload := jsonb_build_object(
      'name', admin_update_profile_basics.user_name,
      'contact_no', admin_update_profile_basics.contact_no,
      'contact_email', admin_update_profile_basics.contact_email,
      'university_id', admin_update_profile_basics.university_id,
      'department', admin_update_profile_basics.department
    );
  else
    profile_table := 'landlord_profiles';
    profile_payload := jsonb_build_object(
      'name', admin_update_profile_basics.user_name,
      'contact_no', admin_update_profile_basics.contact_no,
      'bio', admin_update_profile_basics.bio
    );
  end if;

  select string_agg(
      format(
        '%1$I = (jsonb_populate_record(null::public.%2$I, $1)).%1$I',
        requested.column_name,
        profile_table
      ),
      ', '
    )
    into assignments
    from jsonb_object_keys(profile_payload) as requested(column_name)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = profile_table
     and c.column_name = requested.column_name;

  if assignments is null then
    raise exception 'No editable profile fields are available for this account';
  end if;

  execute format(
    'update public.%I set %s where user_id = $2',
    profile_table,
    assignments
  )
  using profile_payload, admin_update_profile_basics.target_user_id;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Profile record not found';
  end if;
end;
$$;

revoke all on function public.admin_update_profile_basics(uuid, text, text, text, bigint, text, text)
  from public, anon;
grant execute on function public.admin_update_profile_basics(uuid, text, text, text, bigint, text, text)
  to authenticated;

create or replace view public.admin_user_overview as
select
  p.id,
  to_jsonb(p) ->> 'email' as email,
  to_jsonb(p) ->> 'role' as role,
  coalesce(to_jsonb(p) ->> 'status', 'active') as status,
  coalesce(
    nullif(to_jsonb(p) ->> 'created_at', '')::timestamptz,
    now()
  ) as created_at,
  case to_jsonb(p) ->> 'role'
    when 'STUDENT' then coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name')
    when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'name', to_jsonb(l) ->> 'full_name')
  end as display_name,
  case to_jsonb(p) ->> 'role'
    when 'STUDENT' then coalesce(to_jsonb(s) ->> 'contact_no', to_jsonb(s) ->> 'phone')
    when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'contact_no', to_jsonb(l) ->> 'phone')
  end as contact_no,
  to_jsonb(s) ->> 'contact_email' as contact_email,
  case
    when coalesce(to_jsonb(s) ->> 'university_id', '') ~ '^[0-9]+$'
      then (to_jsonb(s) ->> 'university_id')::bigint
  end as university_id,
  to_jsonb(s) ->> 'department' as department,
  to_jsonb(l) ->> 'bio' as bio
from public.profiles p
left join public.student_profiles s on s.user_id = p.id
left join public.landlord_profiles l on l.user_id = p.id
where exists (
  select 1
  from public.profiles admin_profile
  where admin_profile.id = auth.uid()
    and to_jsonb(admin_profile) ->> 'role' = 'ADMIN'
    and coalesce(to_jsonb(admin_profile) ->> 'status', 'active') = 'active'
);

revoke all on public.admin_user_overview from public, anon, authenticated;
grant select on public.admin_user_overview to authenticated;

notify pgrst, 'reload schema';
