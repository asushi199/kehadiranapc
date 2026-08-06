-- Only opaque refresh events are exposed to browser subscriptions. Attendance
-- rows continue to be read through existing API routes, preserving their scope.
create table public.attendance_refresh_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

alter table public.attendance_refresh_events enable row level security;
revoke all on table public.attendance_refresh_events from anon, authenticated;
grant select on table public.attendance_refresh_events to anon, authenticated;
create policy "attendance_refresh_events_read" on public.attendance_refresh_events
  for select to anon, authenticated using (true);

create or replace function public.notify_attendance_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.attendance_refresh_events default values;
  return null;
end;
$$;

create trigger participant_activity_refresh_event
after insert or update or delete on public.participant_activity
for each row execute function public.notify_attendance_refresh();

alter publication supabase_realtime add table public.attendance_refresh_events;
