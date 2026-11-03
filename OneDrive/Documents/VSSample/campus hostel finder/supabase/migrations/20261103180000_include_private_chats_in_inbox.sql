drop function if exists public.get_inbox();

create function public.get_inbox()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_role text,
  name text,
  profile_pic_url text,
  last_message text,
  last_message_at timestamptz,
  thread_type text,
  thread_key text,
  hostel_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with message_threads as (
    select
      'peer'::text as thread_type,
      c.id as conversation_id,
      c.id::text as thread_key,
      case
        when coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a') = auth.uid()::text
          then coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b')::uuid
        else coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a')::uuid
      end as other_user_id,
      m.body as last_message,
      m.created_at as last_message_at,
      null::text as hostel_name
    from public.direct_messages m
    join public.conversations c on c.id = m.conversation_id
    where auth.uid() is not null
      and (
        public.app_has_active_role('STUDENT')
        or public.app_has_active_role('LANDLORD')
      )
      and (
        coalesce(to_jsonb(c) ->> 'participant_a', to_jsonb(c) ->> 'user_a') = auth.uid()::text
        or coalesce(to_jsonb(c) ->> 'participant_b', to_jsonb(c) ->> 'user_b') = auth.uid()::text
      )

    union all

    select
      'booking'::text,
      r.id,
      r.id::text,
      case when r.student_id = auth.uid() then r.landlord_id else r.student_id end,
      m.body,
      m.created_at,
      h.house_name
    from public.hostel_booking_messages m
    join public.hostel_booking_requests r on r.id = m.request_id
    join public.hostels h on h.id = r.hostel_id
    where auth.uid() is not null
      and (
        (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )

    union all

    select
      'interest'::text,
      i.hostel_id,
      i.hostel_id::text || ':' || i.student_id::text,
      case when i.student_id = auth.uid() then h.landlord_id else i.student_id end,
      m.body,
      m.created_at,
      h.house_name
    from public.hostel_interest_messages m
    join public.hostel_interests i
      on i.hostel_id = m.thread_hostel_id
     and i.student_id = m.thread_student_id
    join public.hostels h on h.id = i.hostel_id
    where auth.uid() is not null
      and (
        (i.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (h.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  ),
  latest_threads as (
    select distinct on (mt.thread_type, mt.thread_key)
      mt.conversation_id,
      mt.other_user_id,
      mt.last_message,
      mt.last_message_at,
      mt.thread_type,
      mt.thread_key,
      mt.hostel_name
    from message_threads mt
    order by mt.thread_type, mt.thread_key, mt.last_message_at desc
  )
  select
    lt.conversation_id,
    p.id,
    p.role,
    case p.role
      when 'STUDENT' then s.name
      when 'LANDLORD' then l.name
    end,
    case p.role
      when 'STUDENT' then s.profile_pic_url
      when 'LANDLORD' then l.profile_pic_url
    end,
    lt.last_message,
    lt.last_message_at,
    lt.thread_type,
    lt.thread_key,
    lt.hostel_name
  from latest_threads lt
  join public.profiles p on p.id = lt.other_user_id
  left join public.student_profiles s on s.user_id = p.id
  left join public.landlord_profiles l on l.user_id = p.id
  where p.status = 'active'
    and p.role in ('STUDENT', 'LANDLORD')
    and (
      lt.thread_type <> 'peer'
      or p.role = (
        select me.role
        from public.profiles me
        where me.id = auth.uid()
          and me.status = 'active'
      )
    )
    and (
      public.app_has_active_role('STUDENT')
      or public.app_has_active_role('LANDLORD')
    )
  order by lt.last_message_at desc;
$$;

revoke all on function public.get_inbox() from public, anon;
grant execute on function public.get_inbox() to authenticated;

notify pgrst, 'reload schema';
