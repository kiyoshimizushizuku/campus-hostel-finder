alter table public.conversations
  add column if not exists participant_a uuid references public.profiles (id) on delete cascade,
  add column if not exists participant_b uuid references public.profiles (id) on delete cascade;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at);

do $$
declare
  legacy_column text;
begin
  for legacy_column in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversations'
      and column_name in ('user_a', 'user_b')
  loop
    execute format(
      'alter table public.conversations alter column %I drop not null',
      legacy_column
    );
  end loop;
end;
$$;

with legacy_participants as (
  select
    c.id,
    case
      when coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')::uuid
    end as first_user,
    case
      when coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')::uuid
    end as second_user
  from public.conversations c
)
update public.conversations c
set participant_a = least(legacy.first_user, legacy.second_user),
    participant_b = greatest(legacy.first_user, legacy.second_user)
from legacy_participants legacy
where c.id = legacy.id
  and legacy.first_user is not null
  and legacy.second_user is not null
  and legacy.first_user <> legacy.second_user
  and (c.participant_a is null or c.participant_b is null);

create index if not exists conversations_participants_idx
  on public.conversations (participant_a, participant_b);

alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
revoke all on public.conversations, public.direct_messages from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.direct_messages to authenticated;

create or replace function public.get_student_public_profiles()
returns table (
  user_id uuid,
  name text,
  university_id bigint,
  university_name text,
  department text,
  profile_pic_url text,
  verified boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.user_id, s.name, s.university_id, u.name, s.department, s.profile_pic_url, s.verified
  from public.student_profiles s
  join public.profiles p on p.id = s.user_id
  left join public.universities u on u.id = s.university_id
  where auth.uid() is not null
    and public.app_has_active_role('STUDENT')
    and p.role = 'STUDENT'
    and p.status = 'active'
    and (
      s.user_id = auth.uid()
      or (
        s.university_id is not null
        and s.university_id = (
          select mine.university_id
          from public.student_profiles mine
          where mine.user_id = auth.uid()
        )
      )
    );
$$;

create or replace function public.get_landlord_public_profiles()
returns table (
  user_id uuid,
  name text,
  contact_no text,
  bio text,
  profile_pic_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.user_id, l.name, l.contact_no, l.bio, l.profile_pic_url
  from public.landlord_profiles l
  join public.profiles p on p.id = l.user_id
  where auth.uid() is not null
    and (
      public.app_has_active_role('STUDENT')
      or public.app_has_active_role('LANDLORD')
      or public.app_has_active_role('ADMIN')
    )
    and p.role = 'LANDLORD'
    and p.status = 'active';
$$;

create or replace function public.get_interested_students()
returns table (
  hostel_id uuid,
  student_id uuid,
  name text,
  contact_no text,
  department text,
  verified boolean,
  house_name text,
  created_at timestamptz,
  profile_pic_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.hostel_id, i.student_id, s.name, s.contact_no, s.department,
         s.verified, h.house_name, i.created_at, s.profile_pic_url
  from public.hostel_interests i
  join public.hostels h on h.id = i.hostel_id
  join public.student_profiles s on s.user_id = i.student_id
  join public.profiles p on p.id = i.student_id
  where auth.uid() is not null
    and public.app_has_active_role('LANDLORD')
    and h.landlord_id = auth.uid()
    and p.role = 'STUDENT'
    and p.status = 'active';
$$;

create or replace function public.get_landlord_booking_overview()
returns table (
  id uuid,
  hostel_id uuid,
  student_id uuid,
  landlord_id uuid,
  move_in_date date,
  message text,
  status text,
  created_at timestamptz,
  house_name text,
  student_name text,
  student_contact text,
  department text,
  student_profile_pic_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.hostel_id, r.student_id, r.landlord_id, r.move_in_date,
         r.message, r.status, r.created_at,
         to_jsonb(h) ->> 'house_name',
         coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name'),
         coalesce(to_jsonb(s) ->> 'contact_no', to_jsonb(s) ->> 'phone'),
         to_jsonb(s) ->> 'department',
         to_jsonb(s) ->> 'profile_pic_url'
  from public.hostel_booking_requests r
  join public.hostels h on h.id = r.hostel_id
  left join public.student_profiles s on s.user_id = r.student_id
  where auth.uid() is not null
    and public.app_has_active_role('LANDLORD')
    and r.landlord_id = auth.uid();
$$;

create or replace function public.get_admin_user_overview()
returns table (
  id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  display_name text,
  contact_no text,
  contact_email text,
  university_id bigint,
  department text,
  bio text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    to_jsonb(p) ->> 'email',
    to_jsonb(p) ->> 'role',
    coalesce(to_jsonb(p) ->> 'status', 'active'),
    coalesce(nullif(to_jsonb(p) ->> 'created_at', '')::timestamptz, now()),
    case to_jsonb(p) ->> 'role'
      when 'STUDENT' then coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name')
      when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'name', to_jsonb(l) ->> 'full_name')
    end,
    case to_jsonb(p) ->> 'role'
      when 'STUDENT' then coalesce(to_jsonb(s) ->> 'contact_no', to_jsonb(s) ->> 'phone')
      when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'contact_no', to_jsonb(l) ->> 'phone')
    end,
    to_jsonb(s) ->> 'contact_email',
    case
      when coalesce(to_jsonb(s) ->> 'university_id', '') ~ '^[0-9]+$'
        then (to_jsonb(s) ->> 'university_id')::bigint
    end,
    to_jsonb(s) ->> 'department',
    to_jsonb(l) ->> 'bio'
  from public.profiles p
  left join public.student_profiles s on s.user_id = p.id
  left join public.landlord_profiles l on l.user_id = p.id
  where auth.uid() is not null
    and public.app_has_active_role('ADMIN');
$$;

revoke all on function public.get_student_public_profiles() from public, anon;
revoke all on function public.get_landlord_public_profiles() from public, anon;
revoke all on function public.get_interested_students() from public, anon;
revoke all on function public.get_landlord_booking_overview() from public, anon;
revoke all on function public.get_admin_user_overview() from public, anon;
grant execute on function public.get_student_public_profiles() to authenticated;
grant execute on function public.get_landlord_public_profiles() to authenticated;
grant execute on function public.get_interested_students() to authenticated;
grant execute on function public.get_landlord_booking_overview() to authenticated;
grant execute on function public.get_admin_user_overview() to authenticated;

drop view if exists public.student_public;
create view public.student_public with (security_invoker = true) as
select * from public.get_student_public_profiles();

drop view if exists public.landlord_public;
create view public.landlord_public with (security_invoker = true) as
select * from public.get_landlord_public_profiles();

drop view if exists public.interested_students;
create view public.interested_students with (security_invoker = true) as
select * from public.get_interested_students();

drop view if exists public.landlord_booking_overview;
create view public.landlord_booking_overview with (security_invoker = true) as
select * from public.get_landlord_booking_overview();

drop view if exists public.admin_user_overview;
create view public.admin_user_overview with (security_invoker = true) as
select * from public.get_admin_user_overview();

revoke all on public.student_public, public.landlord_public,
  public.interested_students, public.landlord_booking_overview,
  public.admin_user_overview from public, anon, authenticated;
grant select on public.student_public, public.landlord_public,
  public.interested_students, public.landlord_booking_overview,
  public.admin_user_overview to authenticated;

drop function if exists public.mark_messages_read(text, text, timestamptz);
create function public.mark_messages_read(
  thread_type text,
  thread_key text,
  read_through timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_parts text[];
  is_participant boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating message notifications';
  end if;
  if mark_messages_read.read_through is null then
    raise exception 'A message timestamp is required to update notifications';
  end if;

  if mark_messages_read.thread_type = 'peer' then
    select exists (
      select 1
      from public.conversations c
      where c.id = mark_messages_read.thread_key::uuid
        and auth.uid() in (c.participant_a, c.participant_b)
        and (
          public.app_has_active_role('STUDENT')
          or public.app_has_active_role('LANDLORD')
        )
    ) into is_participant;
  elsif mark_messages_read.thread_type = 'booking' then
    select exists (
      select 1
      from public.hostel_booking_requests r
      where r.id = mark_messages_read.thread_key::uuid
        and (
          (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
          or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
        )
    ) into is_participant;
  elsif mark_messages_read.thread_type = 'interest' then
    thread_parts := string_to_array(mark_messages_read.thread_key, ':');
    if cardinality(thread_parts) <> 2 then
      raise exception 'Invalid interest chat thread';
    end if;
    select exists (
      select 1
      from public.hostel_interests i
      join public.hostels h on h.id = i.hostel_id
      where i.hostel_id = thread_parts[1]::uuid
        and i.student_id = thread_parts[2]::uuid
        and (
          (i.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
          or (h.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
        )
    ) into is_participant;
  else
    raise exception 'Unsupported message thread type';
  end if;

  if not is_participant then
    raise exception 'You cannot update notifications for this conversation';
  end if;

  insert into public.message_read_state (user_id, thread_type, thread_key, last_read_at)
  values (
    auth.uid(),
    mark_messages_read.thread_type,
    mark_messages_read.thread_key,
    least(mark_messages_read.read_through, now())
  )
  on conflict (user_id, thread_type, thread_key)
  do update
    set last_read_at = greatest(message_read_state.last_read_at, excluded.last_read_at);
end;
$$;

create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
  other_role text;
  participant_one uuid;
  participant_two uuid;
  conversation_uuid uuid;
begin
  if current_user_id is null or current_user_id = other_user_id then
    raise exception 'Choose another active account to start a conversation';
  end if;

  select p.role into current_role
  from public.profiles p
  where p.id = current_user_id and p.status = 'active';

  select p.role into other_role
  from public.profiles p
  where p.id = other_user_id and p.status = 'active';

  if current_role is null or other_role is null or current_role <> other_role
     or current_role not in ('STUDENT', 'LANDLORD') then
    raise exception 'Choose an active student or landlord with the same account type';
  end if;

  if current_role = 'STUDENT' and not exists (
    select 1
    from public.student_profiles mine
    join public.student_profiles other on other.university_id = mine.university_id
    where mine.user_id = current_user_id
      and other.user_id = other_user_id
      and mine.university_id is not null
  ) then
    raise exception 'You can only message a student at your university';
  end if;

  participant_one := least(current_user_id, other_user_id);
  participant_two := greatest(current_user_id, other_user_id);
  perform pg_advisory_xact_lock(
    hashtext(participant_one::text),
    hashtext(participant_two::text)
  );
  select c.id into conversation_uuid
  from public.conversations c
  where c.participant_a = participant_one
    and c.participant_b = participant_two
  order by c.id
  limit 1;
  if conversation_uuid is not null then
    return conversation_uuid;
  end if;

  insert into public.conversations (participant_a, participant_b)
  values (participant_one, participant_two)
  returning id into conversation_uuid;
  return conversation_uuid;
end;
$$;

drop policy if exists conversations_read_participant on public.conversations;
create policy conversations_read_participant on public.conversations
for select to authenticated
using (
  (public.app_has_active_role('STUDENT') or public.app_has_active_role('LANDLORD'))
  and (select auth.uid()) in (participant_a, participant_b)
);

drop policy if exists messages_read_participant on public.direct_messages;
create policy messages_read_participant on public.direct_messages
for select to authenticated
using (
  (public.app_has_active_role('STUDENT') or public.app_has_active_role('LANDLORD'))
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (select auth.uid()) in (c.participant_a, c.participant_b)
  )
);

drop policy if exists messages_insert_sender on public.direct_messages;
create policy messages_insert_sender on public.direct_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (public.app_has_active_role('STUDENT') or public.app_has_active_role('LANDLORD'))
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (select auth.uid()) in (c.participant_a, c.participant_b)
  )
);

create or replace function public.get_unread_message_counts()
returns table (other_user_id uuid, unread_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not (
    public.app_has_active_role('STUDENT')
    or public.app_has_active_role('LANDLORD')
  ) then
    return;
  end if;

  return query
  with unread as (
    select case
             when c.participant_a = auth.uid() then c.participant_b
             else c.participant_a
           end as other_id
    from public.direct_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.sender_id <> auth.uid()
      and auth.uid() in (c.participant_a, c.participant_b)
      and m.created_at > coalesce((
        select rs.last_read_at
        from public.message_read_state rs
        where rs.user_id = auth.uid()
          and rs.thread_type = 'peer'
          and rs.thread_key = c.id::text
      ), '-infinity'::timestamptz)

    union all

    select case when r.student_id = auth.uid() then r.landlord_id else r.student_id end
    from public.hostel_booking_messages m
    join public.hostel_booking_requests r on r.id = m.request_id
    where m.sender_id <> auth.uid()
      and m.created_at > coalesce((
        select rs.last_read_at
        from public.message_read_state rs
        where rs.user_id = auth.uid()
          and rs.thread_type = 'booking'
          and rs.thread_key = r.id::text
      ), '-infinity'::timestamptz)
      and (
        (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )

    union all

    select case when i.student_id = auth.uid() then h.landlord_id else i.student_id end
    from public.hostel_interest_messages m
    join public.hostel_interests i
      on i.hostel_id = m.thread_hostel_id
     and i.student_id = m.thread_student_id
    join public.hostels h on h.id = i.hostel_id
    where m.sender_id <> auth.uid()
      and m.created_at > coalesce((
        select rs.last_read_at
        from public.message_read_state rs
        where rs.user_id = auth.uid()
          and rs.thread_type = 'interest'
          and rs.thread_key = i.hostel_id::text || ':' || i.student_id::text
      ), '-infinity'::timestamptz)
      and (
        (i.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (h.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  )
  select unread.other_id, count(*)::bigint
  from unread
  group by unread.other_id;
end;
$$;

create or replace function public.get_unread_message_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(unread.unread_count), 0)::bigint
  from public.get_unread_message_counts() unread;
$$;

revoke all on function public.mark_messages_read(text, text, timestamptz) from public, anon;
revoke all on function public.get_unread_message_counts() from public, anon;
revoke all on function public.get_unread_message_count() from public, anon;
revoke all on function public.get_or_create_conversation(uuid) from public, anon;
grant execute on function public.mark_messages_read(text, text, timestamptz) to authenticated;
grant execute on function public.get_unread_message_counts() to authenticated;
grant execute on function public.get_unread_message_count() to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

do $$
declare
  student_policy record;
  alter_statement text;
begin
  for student_policy in
    select policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'students'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    alter_statement := format(
      'alter policy %I on public.students',
      student_policy.policyname
    );
    if student_policy.qual is not null then
      alter_statement := alter_statement || format(
        ' using (%s)',
        replace(student_policy.qual, 'auth.uid()', '(select auth.uid())')
      );
    end if;
    if student_policy.with_check is not null then
      alter_statement := alter_statement || format(
        ' with check (%s)',
        replace(student_policy.with_check, 'auth.uid()', '(select auth.uid())')
      );
    end if;
    execute alter_statement;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
