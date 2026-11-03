alter table public.conversations
  add column if not exists participant_a uuid references public.profiles (id) on delete cascade,
  add column if not exists participant_b uuid references public.profiles (id) on delete cascade;

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

update public.conversations c
set participant_a = least(
      coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')::uuid,
      coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')::uuid
    ),
    participant_b = greatest(
      coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')::uuid,
      coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')::uuid
    )
where (c.participant_a is null or c.participant_b is null)
  and coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists conversations_participants_idx
  on public.conversations (participant_a, participant_b);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at);

alter table public.direct_messages enable row level security;
revoke all on public.conversations, public.direct_messages from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.direct_messages to authenticated;

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
  where p.id = current_user_id
    and p.status = 'active';

  select p.role into other_role
  from public.profiles p
  where p.id = other_user_id
    and p.status = 'active';

  if current_role is null or other_role is null
     or current_role <> other_role
     or current_role not in ('STUDENT', 'LANDLORD') then
    raise exception 'Choose an active student or landlord with the same account type';
  end if;

  if current_role = 'STUDENT' and not exists (
    select 1
    from public.student_profiles mine
    join public.student_profiles other
      on other.university_id = mine.university_id
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

create or replace function public.get_inbox()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_role text,
  name text,
  profile_pic_url text,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with latest_messages as (
    select distinct on (c.id)
      c.id as conversation_id,
      case
        when coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a') = auth.uid()::text
          then coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')::uuid
        else coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')::uuid
      end as other_user_id,
      m.body as last_message,
      m.created_at as last_message_at
    from public.direct_messages m
    join public.conversations c on c.id = m.conversation_id
    where auth.uid() is not null
      and (
        coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a') = auth.uid()::text
        or coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b') = auth.uid()::text
      )
    order by c.id, m.created_at desc, m.id desc
  )
  select
    lm.conversation_id,
    p.id,
    to_jsonb(p) ->> 'role',
    case to_jsonb(p) ->> 'role'
      when 'STUDENT' then coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name')
      when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'name', to_jsonb(l) ->> 'full_name')
    end,
    case to_jsonb(p) ->> 'role'
      when 'STUDENT' then to_jsonb(s) ->> 'profile_pic_url'
      when 'LANDLORD' then to_jsonb(l) ->> 'profile_pic_url'
    end,
    lm.last_message,
    lm.last_message_at
  from latest_messages lm
  join public.profiles p on p.id = lm.other_user_id
  left join public.student_profiles s on s.user_id = p.id
  left join public.landlord_profiles l on l.user_id = p.id
  where p.status = 'active'
    and to_jsonb(p) ->> 'role' = (
      select to_jsonb(me) ->> 'role'
      from public.profiles me
      where me.id = auth.uid()
        and coalesce(to_jsonb(me) ->> 'status', 'active') = 'active'
    )
    and to_jsonb(p) ->> 'role' in ('STUDENT', 'LANDLORD')
  order by lm.last_message_at desc;
$$;

create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  user_id uuid,
  role text,
  name text,
  department text,
  university_name text,
  bio text,
  contact_no text,
  verified boolean,
  profile_pic_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.role,
    case p.role
      when 'STUDENT' then s.name
      when 'LANDLORD' then l.name
    end,
    s.department,
    u.name,
    l.bio,
    case
      when p.role = 'LANDLORD' then l.contact_no
      when public.app_has_active_role('LANDLORD')
        and exists (
          select 1
          from public.hostel_interests i
          join public.hostels h on h.id = i.hostel_id
          where i.student_id = p.id and h.landlord_id = auth.uid()
        ) then s.contact_no
      when public.app_has_active_role('LANDLORD')
        and exists (
          select 1
          from public.hostel_booking_requests r
          where r.student_id = p.id and r.landlord_id = auth.uid()
        ) then s.contact_no
    end,
    s.verified,
    coalesce(s.profile_pic_url, l.profile_pic_url)
  from public.profiles p
  left join public.student_profiles s on s.user_id = p.id
  left join public.landlord_profiles l on l.user_id = p.id
  left join public.universities u on u.id = s.university_id
  where p.id = p_user_id
    and p.status = 'active'
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or (
        public.app_has_active_role('STUDENT')
        and (
          p.role = 'LANDLORD'
          or (
            p.role = 'STUDENT'
            and exists (
              select 1
              from public.student_profiles mine
              where mine.user_id = auth.uid()
                and mine.university_id is not null
                and mine.university_id = s.university_id
            )
          )
        )
      )
      or (
        public.app_has_active_role('LANDLORD')
        and (
          p.role = 'LANDLORD'
          or (
            p.role = 'STUDENT'
            and (
              exists (
                select 1
                from public.hostel_interests i
                join public.hostels h on h.id = i.hostel_id
                where i.student_id = p.id and h.landlord_id = auth.uid()
              )
              or exists (
                select 1
                from public.hostel_booking_requests r
                where r.student_id = p.id and r.landlord_id = auth.uid()
              )
            )
          )
        )
      )
    );
$$;

revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

drop view if exists public.interested_students;
drop function if exists public.get_interested_students();

alter table public.hostel_interests
  add column if not exists status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.hostel_interests'::regclass
      and conname = 'hostel_interests_status_check'
  ) then
    alter table public.hostel_interests
      add constraint hostel_interests_status_check
      check (status in ('pending', 'accepted', 'declined'));
  end if;
end;
$$;

create function public.get_interested_students()
returns table (
  hostel_id uuid,
  student_id uuid,
  name text,
  contact_no text,
  department text,
  verified boolean,
  house_name text,
  created_at timestamptz,
  profile_pic_url text,
  status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.hostel_id, i.student_id, s.name, s.contact_no, s.department,
         s.verified, h.house_name, i.created_at, s.profile_pic_url, i.status
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

create view public.interested_students with (security_invoker = true) as
select * from public.get_interested_students();

revoke all on public.interested_students from public, anon, authenticated;
grant select on public.interested_students to authenticated;
revoke all on function public.get_interested_students() from public, anon;
grant execute on function public.get_interested_students() to authenticated;

create or replace function public.respond_to_hostel_interest(
  p_hostel_id uuid,
  p_student_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.app_has_active_role('LANDLORD') then
    raise exception 'Active landlord access required';
  end if;
  if p_status not in ('accepted', 'declined') then
    raise exception 'Interest response must be accepted or declined';
  end if;

  update public.hostel_interests i
  set status = p_status
  from public.hostels h
  where i.hostel_id = p_hostel_id
    and i.student_id = p_student_id
    and h.id = i.hostel_id
    and h.landlord_id = auth.uid();

  if not found then
    raise exception 'Student interest not found for your listing';
  end if;
end;
$$;

revoke all on function public.respond_to_hostel_interest(uuid, uuid, text) from public, anon;
grant execute on function public.respond_to_hostel_interest(uuid, uuid, text) to authenticated;

grant delete on public.reports to authenticated;
drop policy if exists reports_delete_admin on public.reports;
create policy reports_delete_admin on public.reports
for delete to authenticated
using (public.app_has_active_role('ADMIN'));

drop function if exists public.get_unread_message_count();
drop function if exists public.get_unread_message_counts();
drop function if exists public.mark_messages_read(text, text, timestamptz);
drop table if exists public.message_read_state;

revoke all on function public.get_inbox() from public, anon;
revoke all on function public.get_or_create_conversation(uuid) from public, anon;
grant execute on function public.get_inbox() to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
