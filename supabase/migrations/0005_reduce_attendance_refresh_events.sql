create or replace function public.notify_attendance_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
    and OLD.first_lookup_at is not distinct from NEW.first_lookup_at
    and OLD.attendance_status is not distinct from NEW.attendance_status
    and OLD.attendance_confirmed_at is not distinct from NEW.attendance_confirmed_at then
    return null;
  end if;

  insert into public.attendance_refresh_events default values;
  return null;
end;
$$;
