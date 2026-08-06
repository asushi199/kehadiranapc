import 'server-only';

import type { LiveAttendanceRow } from '@/lib/data/live-attendance';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

interface AttendanceSnapshot {
  rows: LiveAttendanceRow[];
  sessionName: string | null;
}

type ParticipantRow = {
  id: string;
  bil: number;
  counter_no: number;
  name: string;
  organization: string;
  seat_no: number;
};

function buildRows(participants: ParticipantRow[], activities: Map<string, { first_lookup_at: string | null; attendance_status: string; attendance_confirmed_at: string | null }>): LiveAttendanceRow[] {
  return participants.map((participant) => {
    const activity = activities.get(participant.id);
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
  });
}

export async function getCounterAttendanceSnapshot(counterNo: number): Promise<AttendanceSnapshot> {
  const supabase = createAdminSupabaseClient();
  const [{ data: session, error: sessionError }, { data: participants, error: participantError }] = await Promise.all([
    supabase.from('event_sessions').select('id, name').eq('is_active', true).maybeSingle(),
    supabase.from('participants').select('id, bil, counter_no, name, organization, seat_no').eq('is_active', true).eq('counter_no', counterNo).order('bil'),
  ]);
  if (sessionError) throw new Error('Tidak dapat membaca Session aktif.');
  if (participantError) throw new Error('Tidak dapat membaca senarai penerima.');
  if (!session || participants.length === 0) return { rows: buildRows(participants, new Map()), sessionName: session?.name ?? null };

  const { data: activities, error: activityError } = await supabase
    .from('participant_activity')
    .select('participant_id, first_lookup_at, attendance_status, attendance_confirmed_at')
    .eq('session_id', session.id)
    .in('participant_id', participants.map((participant) => participant.id));
  if (activityError) throw new Error('Tidak dapat membaca rekod kehadiran.');

  return { rows: buildRows(participants, new Map(activities.map((activity) => [activity.participant_id, activity]))), sessionName: session.name };
}

export async function getConfirmedAttendanceSnapshot(): Promise<AttendanceSnapshot> {
  const supabase = createAdminSupabaseClient();
  const { data: session, error: sessionError } = await supabase.from('event_sessions').select('id, name').eq('is_active', true).maybeSingle();
  if (sessionError) throw new Error('Tidak dapat membaca Session aktif.');
  if (!session) return { rows: [], sessionName: null };

  const { data: activities, error: activityError } = await supabase
    .from('participant_activity')
    .select('participant_id, first_lookup_at, attendance_status, attendance_confirmed_at')
    .eq('session_id', session.id)
    .eq('attendance_status', 'confirmed');
  if (activityError) throw new Error('Tidak dapat membaca rekod kehadiran.');
  if (activities.length === 0) return { rows: [], sessionName: session.name };

  const { data: participants, error: participantError } = await supabase
    .from('participants')
    .select('id, bil, counter_no, name, organization, seat_no')
    .eq('is_active', true)
    .in('id', activities.map((activity) => activity.participant_id))
    .order('bil');
  if (participantError) throw new Error('Tidak dapat membaca senarai penerima.');

  return { rows: buildRows(participants, new Map(activities.map((activity) => [activity.participant_id, activity]))), sessionName: session.name };
}
