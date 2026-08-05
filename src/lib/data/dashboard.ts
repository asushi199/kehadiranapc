import 'server-only';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export interface DashboardRow {
  participantId: string;
  bil: number;
  counterNo: number;
  name: string;
  organization: string;
  seatNo: number;
  checked: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
}

export interface DashboardSnapshot {
  rows: DashboardRow[];
  session: { id: string; name: string; mode: string } | null;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const supabase = createAdminSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from('event_sessions')
    .select('id, name, mode')
    .eq('is_active', true)
    .maybeSingle();
  if (sessionError) throw new Error('Tidak dapat membaca Session aktif.');

  const { data: participants, error: participantError } = await supabase
    .from('participants')
    .select('id, bil, name, organization, seat_no, counter_no')
    .eq('is_active', true)
    .order('bil');
  if (participantError) throw new Error('Tidak dapat membaca senarai penerima.');

  const activities = session
    ? await supabase.from('participant_activity').select('participant_id, first_lookup_at, attendance_status, attendance_confirmed_at').eq('session_id', session.id)
    : { data: [], error: null };
  if (activities.error) throw new Error('Tidak dapat membaca rekod kehadiran.');
  const activityByParticipant = new Map(activities.data.map((activity) => [activity.participant_id, activity]));

  return {
    session,
    rows: participants.map((participant) => {
      const activity = activityByParticipant.get(participant.id);
      return {
        participantId: participant.id,
        bil: participant.bil,
        counterNo: participant.counter_no,
        name: participant.name,
        organization: participant.organization,
        seatNo: participant.seat_no,
        checked: Boolean(activity?.first_lookup_at),
        confirmed: activity?.attendance_status === 'confirmed',
        confirmedAt: activity?.attendance_confirmed_at ?? null,
      };
    }),
  };
}
