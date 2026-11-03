create table if not exists public.message_read_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_type text not null check (thread_type in ('peer', 'booking', 'interest')),
  thread_key text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_type, thread_key)
);

alter table public.message_read_state enable row level security;
revoke all on public.message_read_state from public, anon, authenticated;

drop function if exists public.mark_messages_read(text, text);

create or replace function public.mark_messages_read(
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

  if thread_type = 'peer' then
    select exists (
      select 1
      from public.conversations c
      where c.id = thread_key::uuid
        and auth.uid()::text in (
          coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a'),
          coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')
        )
        and public.app_has_active_role('STUDENT')
    ) into is_participant;
  elsif thread_type = 'booking' then
    select exists (
      select 1
      from public.hostel_booking_requests r
      where r.id = thread_key::uuid
        and (
          (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
          or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
        )
    ) into is_participant;
  elsif thread_type = 'interest' then
    thread_parts := string_to_array(thread_key, ':');
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

create or replace function public.get_unread_message_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  unread_count bigint := 0;
  thread_unread_count bigint;
begin
  if to_regclass('public.direct_messages') is not null then
    execute $query$
      select count(*)
      from public.direct_messages m
      join public.conversations c on c.id = m.conversation_id
      where public.app_has_active_role('STUDENT')
        and auth.uid()::text in (
          coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a'),
          coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')
        )
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce((
          select rs.last_read_at
          from public.message_read_state rs
          where rs.user_id = auth.uid()
            and rs.thread_type = 'peer'
            and rs.thread_key = c.id::text
        ), '-infinity'::timestamptz)
    $query$ into unread_count;
  elsif to_regclass('public.messages') is not null then
    execute $query$
      select count(*)
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where public.app_has_active_role('STUDENT')
        and auth.uid()::text in (
          coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a'),
          coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')
        )
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce((
          select rs.last_read_at
          from public.message_read_state rs
          where rs.user_id = auth.uid()
            and rs.thread_type = 'peer'
            and rs.thread_key = c.id::text
        ), '-infinity'::timestamptz)
    $query$ into unread_count;
  end if;

  select count(*)
    into thread_unread_count
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
      );
  unread_count := unread_count + thread_unread_count;

  select count(*)
    into thread_unread_count
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
      );
  unread_count := unread_count + thread_unread_count;

  return unread_count;
end;
$$;

revoke all on function public.mark_messages_read(text, text, timestamptz) from public, anon;
revoke all on function public.get_unread_message_count() from public, anon;
grant execute on function public.mark_messages_read(text, text, timestamptz) to authenticated;
grant execute on function public.get_unread_message_count() to authenticated;

notify pgrst, 'reload schema';
