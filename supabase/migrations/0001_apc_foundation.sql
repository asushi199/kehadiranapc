create extension if not exists pgcrypto;

create type public.app_role as enum ('counter_staff', 'secretariat', 'super_admin');
create type public.session_mode as enum ('rehearsal', 'live');
create type public.attendance_status as enum ('not_confirmed', 'confirmed');
create type public.confirmation_source as enum ('participant', 'staff');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_counter_scopes (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  counter_no smallint not null check (counter_no between 1 and 6),
  created_at timestamptz not null default now(),
  primary key (user_id, counter_no)
);

create table public.participant_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  source_checksum text not null,
  validation_report jsonb not null default '{}'::jsonb,
  status text not null check (status in ('validated', 'applied', 'failed')),
  added_count integer not null default 0 check (added_count >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  deactivated_count integer not null default 0 check (deactivated_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  bil integer not null unique check (bil between 1 and 9999),
  name text not null check (length(trim(name)) >= 3),
  name_normalized text not null,
  ic_hmac text not null unique check (ic_hmac ~ '^[a-f0-9]{64}$'),
  ic_last4 char(4) not null check (ic_last4 ~ '^[0-9]{4}$'),
  organization text not null check (length(trim(organization)) >= 2),
  seat_no integer not null unique check (seat_no between 1 and 9999),
  counter_no smallint not null check (counter_no between 1 and 6),
  is_active boolean not null default true,
  source_batch_id uuid references public.participant_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participants_name_normalized_idx on public.participants using btree (name_normalized text_pattern_ops);
create index participants_active_counter_bil_idx on public.participants (counter_no, bil) where is_active;

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  mode public.session_mode not null,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index one_active_apc_session_idx on public.event_sessions ((is_active)) where is_active;

create table public.participant_activity (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  session_id uuid not null references public.event_sessions(id) on delete restrict,
  first_lookup_at timestamptz,
  last_lookup_at timestamptz,
  lookup_count integer not null default 0 check (lookup_count >= 0),
  attendance_status public.attendance_status not null default 'not_confirmed',
  attendance_confirmed_at timestamptz,
  confirmation_source public.confirmation_source,
  confirmed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (participant_id, session_id),
  check ((attendance_status = 'confirmed') = (attendance_confirmed_at is not null)),
  check ((attendance_status = 'confirmed') = (confirmation_source is not null)),
  check (lookup_count = 0 or first_lookup_at is not null),
  check (last_lookup_at is null or first_lookup_at is not null)
);

create index participant_activity_session_status_idx on public.participant_activity (session_id, attendance_status);
create index participant_activity_session_updated_idx on public.participant_activity (session_id, updated_at desc);

create table public.rehearsal_reset_backups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions(id) on delete restrict,
  record_count integer not null check (record_count >= 0),
  reset_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.rehearsal_reset_backup_items (
  backup_id uuid not null references public.rehearsal_reset_backups(id) on delete cascade,
  activity_id uuid not null,
  participant_id uuid not null references public.participants(id) on delete restrict,
  activity_snapshot jsonb not null,
  primary key (backup_id, activity_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create table public.rate_limit_buckets (
  route text not null,
  key_hmac text not null,
  window_starts_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (route, key_hmac, window_starts_at)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger participants_updated_at before update on public.participants for each row execute function public.set_updated_at();
create trigger event_sessions_updated_at before update on public.event_sessions for each row execute function public.set_updated_at();
create trigger participant_activity_updated_at before update on public.participant_activity for each row execute function public.set_updated_at();
create trigger rate_limit_buckets_updated_at before update on public.rate_limit_buckets for each row execute function public.set_updated_at();

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_active and role in ('counter_staff', 'secretariat', 'super_admin')
  );
$$;

create or replace function public.is_secretariat_or_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_active and role in ('secretariat', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_active and role = 'super_admin'
  );
$$;

create or replace function public.can_read_participant(target_counter_no smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_secretariat_or_super_admin()
  or exists (
    select 1 from public.staff_counter_scopes
    where user_id = auth.uid() and counter_no = target_counter_no
  );
$$;

grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_secretariat_or_super_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.can_read_participant(smallint) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.staff_counter_scopes enable row level security;
alter table public.participant_import_batches enable row level security;
alter table public.participants enable row level security;
alter table public.event_sessions enable row level security;
alter table public.participant_activity enable row level security;
alter table public.rehearsal_reset_backups enable row level security;
alter table public.rehearsal_reset_backup_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy "profiles_read_self" on public.user_profiles for select to authenticated using (id = auth.uid());
create policy "profiles_read_super_admin" on public.user_profiles for select to authenticated using (public.is_super_admin());
create policy "counter_scopes_read_self_or_super_admin" on public.staff_counter_scopes for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "participants_read_by_scope" on public.participants for select to authenticated using (public.can_read_participant(counter_no));
create policy "sessions_read_by_admin" on public.event_sessions for select to authenticated using (public.is_active_admin());
create policy "activity_read_by_scope" on public.participant_activity for select to authenticated using (
  exists (select 1 from public.participants p where p.id = participant_id and public.can_read_participant(p.counter_no))
);
create policy "imports_read_by_super_admin" on public.participant_import_batches for select to authenticated using (public.is_super_admin());
create policy "reset_backups_read_by_super_admin" on public.rehearsal_reset_backups for select to authenticated using (public.is_super_admin());
create policy "reset_backup_items_read_by_super_admin" on public.rehearsal_reset_backup_items for select to authenticated using (public.is_super_admin());
create policy "audit_read_by_super_admin" on public.audit_logs for select to authenticated using (public.is_super_admin());

-- Mutations are deliberately denied to browser clients. Trusted server Route Handlers
-- use the service-role key after validating the authenticated user and role.
revoke all on table public.participants, public.event_sessions, public.participant_activity, public.participant_import_batches, public.rehearsal_reset_backups, public.rehearsal_reset_backup_items, public.audit_logs, public.rate_limit_buckets from anon, authenticated;
grant select on table public.user_profiles, public.staff_counter_scopes, public.participants, public.event_sessions, public.participant_activity, public.participant_import_batches, public.rehearsal_reset_backups, public.rehearsal_reset_backup_items, public.audit_logs to authenticated;

create or replace function public.record_participant_lookup(p_participant_id uuid, p_session_id uuid)
returns public.participant_activity
language plpgsql
security definer
set search_path = public
as $$
declare
  activity public.participant_activity;
  recorded_at timestamptz := now();
begin
  insert into public.participant_activity (
    participant_id, session_id, first_lookup_at, last_lookup_at, lookup_count
  ) values (
    p_participant_id, p_session_id, recorded_at, recorded_at, 1
  ) on conflict (participant_id, session_id) do update
    set last_lookup_at = excluded.last_lookup_at,
        lookup_count = public.participant_activity.lookup_count + 1,
        updated_at = recorded_at
  returning * into activity;

  return activity;
end;
$$;

create or replace function public.confirm_participant_attendance(p_participant_id uuid, p_session_id uuid)
returns public.participant_activity
language plpgsql
security definer
set search_path = public
as $$
declare
  activity public.participant_activity;
  confirmed_at timestamptz := now();
begin
  update public.participant_activity
  set attendance_status = 'confirmed',
      attendance_confirmed_at = coalesce(attendance_confirmed_at, confirmed_at),
      confirmation_source = coalesce(confirmation_source, 'participant'),
      updated_at = confirmed_at
  where participant_id = p_participant_id and session_id = p_session_id
  returning * into activity;

  if activity is null then
    raise exception 'Participant lookup is required before attendance confirmation';
  end if;

  return activity;
end;
$$;

create or replace function public.check_rate_limit(
  p_route text,
  p_key_hmac text,
  p_window_starts_at timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.rate_limit_buckets (route, key_hmac, window_starts_at, request_count)
  values (p_route, p_key_hmac, p_window_starts_at, 1)
  on conflict (route, key_hmac, window_starts_at) do update
    set request_count = public.rate_limit_buckets.request_count + 1,
        updated_at = now()
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.record_participant_lookup(uuid, uuid) from public, anon, authenticated;
revoke all on function public.confirm_participant_attendance(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.record_participant_lookup(uuid, uuid) to service_role;
grant execute on function public.confirm_participant_attendance(uuid, uuid) to service_role;
grant execute on function public.check_rate_limit(text, text, timestamptz, integer) to service_role;
