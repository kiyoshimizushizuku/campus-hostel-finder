alter table public.reports
  add column if not exists hostel_id uuid references public.hostels (id) on delete set null,
  add column if not exists report_type text,
  add column if not exists details text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_details_length_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_details_length_check
      check (details is null or length(trim(details)) between 1 and 5000) not valid;
  end if;
end;
$$;

alter table public.reports enable row level security;

notify pgrst, 'reload schema';
