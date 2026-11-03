create or replace function public.app_has_active_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and to_jsonb(p) ->> 'role' = required_role
      and coalesce(to_jsonb(p) ->> 'status', 'active') = 'active'
  );
$$;

revoke all on function public.app_has_active_role(text) from public, anon;
grant execute on function public.app_has_active_role(text) to authenticated;

alter table public.student_profiles
  add column if not exists target_university_id bigint,
  add column if not exists target_lat double precision,
  add column if not exists target_lng double precision;

create table if not exists public.hostel_booking_requests (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  move_in_date date not null,
  message text not null default '' check (length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create unique index if not exists hostel_booking_requests_active_unique
  on public.hostel_booking_requests (hostel_id, student_id)
  where status in ('pending', 'accepted');
create index if not exists hostel_booking_requests_landlord_idx
  on public.hostel_booking_requests (landlord_id, status, created_at desc);
create index if not exists hostel_booking_requests_student_idx
  on public.hostel_booking_requests (student_id, created_at desc);

alter table public.hostel_booking_requests enable row level security;
revoke all on public.hostel_booking_requests from public, anon, authenticated;
grant select on public.hostel_booking_requests to authenticated;
grant insert (hostel_id, student_id, landlord_id, move_in_date, message)
  on public.hostel_booking_requests to authenticated;

drop policy if exists booking_requests_read_participant on public.hostel_booking_requests;
create policy booking_requests_read_participant on public.hostel_booking_requests
for select to authenticated
using (
  (student_id = auth.uid() and public.app_has_active_role('STUDENT'))
  or (landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
);

drop policy if exists booking_requests_insert_student on public.hostel_booking_requests;
create policy booking_requests_insert_student on public.hostel_booking_requests
for insert to authenticated
with check (
  student_id = auth.uid()
  and public.app_has_active_role('STUDENT')
  and landlord_id = (
    select h.landlord_id
    from public.hostels h
    where h.id = hostel_id
      and h.status = 'approved'
      and h.vacancy_count > 0
  )
);

create or replace function public.respond_to_booking_request(
  request_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.hostel_booking_requests%rowtype;
  available_rooms integer;
begin
  if not public.app_has_active_role('LANDLORD') then
    raise exception 'Only active landlords can respond to booking requests';
  end if;

  if next_status not in ('accepted', 'declined') then
    raise exception 'Unsupported booking response';
  end if;

  select *
    into request_row
    from public.hostel_booking_requests
    where id = request_id
    for update;

  if not found or request_row.landlord_id <> auth.uid() then
    raise exception 'Booking request not found';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'This booking request has already been answered';
  end if;

  if next_status = 'accepted' then
    select vacancy_count
      into available_rooms
      from public.hostels
      where id = request_row.hostel_id
        and landlord_id = auth.uid()
      for update;

    if available_rooms is null or available_rooms < 1 then
      raise exception 'No vacant rooms remain for this listing';
    end if;

    update public.hostels
      set vacancy_count = vacancy_count - 1
      where id = request_row.hostel_id;
  end if;

  update public.hostel_booking_requests
    set status = next_status
    where id = request_row.id;
end;
$$;

revoke all on function public.respond_to_booking_request(uuid, text) from public, anon;
grant execute on function public.respond_to_booking_request(uuid, text) to authenticated;

create table if not exists public.hostel_booking_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hostel_booking_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists hostel_booking_messages_request_idx
  on public.hostel_booking_messages (request_id, created_at);

alter table public.hostel_booking_messages enable row level security;
revoke all on public.hostel_booking_messages from public, anon, authenticated;
grant select on public.hostel_booking_messages to authenticated;
grant insert (request_id, sender_id, body) on public.hostel_booking_messages to authenticated;

drop policy if exists booking_messages_read_participant on public.hostel_booking_messages;
create policy booking_messages_read_participant on public.hostel_booking_messages
for select to authenticated
using (
  exists (
    select 1
    from public.hostel_booking_requests r
    where r.id = request_id
      and (
        (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  )
);

drop policy if exists booking_messages_insert_participant on public.hostel_booking_messages;
create policy booking_messages_insert_participant on public.hostel_booking_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.hostel_booking_requests r
    where r.id = request_id
      and (
        (r.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (r.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  )
);

create table if not exists public.hostel_interest_messages (
  id uuid primary key default gen_random_uuid(),
  thread_hostel_id uuid not null,
  thread_student_id uuid not null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (thread_hostel_id, thread_student_id)
    references public.hostel_interests (hostel_id, student_id)
    on delete cascade
);

create index if not exists hostel_interest_messages_thread_idx
  on public.hostel_interest_messages (thread_hostel_id, thread_student_id, created_at);

alter table public.hostel_interest_messages enable row level security;
revoke all on public.hostel_interest_messages from public, anon, authenticated;
grant select on public.hostel_interest_messages to authenticated;
grant insert (thread_hostel_id, thread_student_id, sender_id, body)
  on public.hostel_interest_messages to authenticated;

drop policy if exists interest_messages_read_participant on public.hostel_interest_messages;
create policy interest_messages_read_participant on public.hostel_interest_messages
for select to authenticated
using (
  exists (
    select 1
    from public.hostel_interests i
    join public.hostels h on h.id = i.hostel_id
    where i.hostel_id = thread_hostel_id
      and i.student_id = thread_student_id
      and (
        (i.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (h.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  )
);

drop policy if exists interest_messages_insert_participant on public.hostel_interest_messages;
create policy interest_messages_insert_participant on public.hostel_interest_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.hostel_interests i
    join public.hostels h on h.id = i.hostel_id
    where i.hostel_id = thread_hostel_id
      and i.student_id = thread_student_id
      and (
        (i.student_id = auth.uid() and public.app_has_active_role('STUDENT'))
        or (h.landlord_id = auth.uid() and public.app_has_active_role('LANDLORD'))
      )
  )
);

create or replace view public.landlord_booking_overview as
select
  r.id,
  r.hostel_id,
  r.student_id,
  r.landlord_id,
  r.move_in_date,
  r.message,
  r.status,
  r.created_at,
  to_jsonb(h) ->> 'house_name' as house_name,
  coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name') as student_name,
  coalesce(to_jsonb(s) ->> 'contact_no', to_jsonb(s) ->> 'phone') as student_contact,
  to_jsonb(s) ->> 'department' as department
from public.hostel_booking_requests r
join public.hostels h on h.id = r.hostel_id
left join public.student_profiles s on s.user_id = r.student_id
where r.landlord_id = auth.uid()
  and public.app_has_active_role('LANDLORD');

revoke all on public.landlord_booking_overview from public, anon, authenticated;
grant select on public.landlord_booking_overview to authenticated;

create or replace view public.admin_user_overview as
select
  p.id,
  to_jsonb(p) ->> 'email' as email,
  p.role,
  coalesce(to_jsonb(p) ->> 'status', 'active') as status,
  coalesce(
    nullif(to_jsonb(p) ->> 'created_at', '')::timestamptz,
    now()
  ) as created_at,
  case p.role
    when 'STUDENT' then coalesce(to_jsonb(s) ->> 'name', to_jsonb(s) ->> 'full_name')
    when 'LANDLORD' then coalesce(to_jsonb(l) ->> 'name', to_jsonb(l) ->> 'full_name')
  end as display_name,
  case p.role
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
where public.app_has_active_role('ADMIN');

revoke all on public.admin_user_overview from public, anon, authenticated;
grant select on public.admin_user_overview to authenticated;

notify pgrst, 'reload schema';
