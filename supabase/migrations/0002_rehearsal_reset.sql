-- Shared-password deployments do not have an auth.users identity for reset actions.
-- The actor remains recorded in audit_logs.metadata as "shared_staff".
alter table public.rehearsal_reset_backups
  alter column reset_by drop not null;

create or replace function public.reset_rehearsal_session(
  p_session_id uuid,
  p_actor text
)
returns table (backup_id uuid, record_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode public.session_mode;
  v_name text;
  v_backup_id uuid;
  v_record_count integer;
begin
  select mode, name
    into v_mode, v_name
  from public.event_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session tidak ditemui';
  end if;

  if v_mode <> 'rehearsal' then
    raise exception 'Session rasmi tidak boleh direset';
  end if;

  select count(*)::integer
    into v_record_count
  from public.participant_activity
  where session_id = p_session_id;

  insert into public.rehearsal_reset_backups (session_id, record_count, reset_by)
  values (p_session_id, v_record_count, null)
  returning id into v_backup_id;

  insert into public.rehearsal_reset_backup_items (
    backup_id,
    activity_id,
    participant_id,
    activity_snapshot
  )
  select
    v_backup_id,
    activity.id,
    activity.participant_id,
    to_jsonb(activity)
  from public.participant_activity as activity
  where activity.session_id = p_session_id;

  delete from public.participant_activity
  where session_id = p_session_id;

  insert into public.audit_logs (user_id, action, target_type, target_id, metadata)
  values (
    null,
    'rehearsal_records_reset',
    'event_session',
    p_session_id::text,
    jsonb_build_object(
      'actor', p_actor,
      'session_name', v_name,
      'record_count', v_record_count,
      'backup_id', v_backup_id
    )
  );

  return query select v_backup_id, v_record_count;
end;
$$;

revoke all on function public.reset_rehearsal_session(uuid, text) from public, anon, authenticated;
grant execute on function public.reset_rehearsal_session(uuid, text) to service_role;
