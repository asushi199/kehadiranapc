import 'server-only';

import type { PublicParticipantResult, PublicSearchSuggestion } from '@/types/app';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createLookupToken } from '@/lib/security/lookup-token';
import { createIcHmac } from '@/lib/security/hmac';
import { maskIc, normalizeName } from '@/lib/security/normalization';
import type { EventSession, Participant, ParticipantActivity } from '@/types/database';

type ActivityRecord = Pick<ParticipantActivity, 'attendance_status' | 'attendance_confirmed_at' | 'first_lookup_at'>;

function toPublicResult(participant: Participant, activity: ActivityRecord, sessionId: string): PublicParticipantResult {
  const status =
    activity.attendance_status === 'confirmed'
      ? 'Hadir Disahkan'
      : activity.first_lookup_at
        ? 'Telah Semak'
        : 'Belum Semak';

  return {
    lookupToken: createLookupToken('lookup', participant.id, sessionId),
    name: participant.name,
    organization: participant.organization,
    bil: participant.bil,
    seatNo: participant.seat_no,
    counterNo: participant.counter_no,
    maskedIc: maskIc(participant.ic_last4),
    status,
    confirmedAt: activity.attendance_confirmed_at,
  };
}

export async function getActiveSession(): Promise<EventSession> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from('event_sessions').select('*').eq('is_active', true).maybeSingle();

  if (error || !data) {
    throw new Error('Sesi APC belum diaktifkan. Sila hubungi Urus Setia.');
  }

  return data;
}

export async function searchParticipantsByName(query: string): Promise<PublicSearchSuggestion[]> {
  const normalized = normalizeName(query);
  const supabase = createAdminSupabaseClient();
  const [session, { data, error }] = await Promise.all([
    getActiveSession(),
    supabase
      .from('participants')
      .select('id, name, organization, ic_last4')
      .eq('is_active', true)
      .ilike('name_normalized', `%${normalized.replace(/[%_]/g, '\\$&')}%`)
      .order('bil', { ascending: true })
      .limit(8),
  ]);

  if (error) {
    throw new Error('Carian tidak dapat dilakukan. Sila cuba semula.');
  }

  return data.map((participant) => ({
    selectionToken: createLookupToken('selection', participant.id, session.id),
    name: participant.name,
    organization: participant.organization,
    icLast4: participant.ic_last4,
  }));
}

async function getParticipantById(participantId: string): Promise<Participant | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error('Carian tidak dapat dilakukan. Sila cuba semula.');
  return data;
}

export async function lookupParticipantByIc(ic: string): Promise<PublicParticipantResult | null> {
  const supabase = createAdminSupabaseClient();
  const [session, { data: participant, error }] = await Promise.all([
    getActiveSession(),
    supabase
      .from('participants')
      .select('*')
      .eq('ic_hmac', createIcHmac(ic))
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (error) throw new Error('Carian tidak dapat dilakukan. Sila cuba semula.');
  if (!participant) return null;

  return recordLookupAndBuildResult(participant, session.id);
}

export async function lookupParticipantBySelection(participantId: string, sessionId: string): Promise<PublicParticipantResult | null> {
  const [session, participant] = await Promise.all([getActiveSession(), getParticipantById(participantId)]);
  if (session.id !== sessionId) {
    throw new Error('Sesi carian telah berubah. Sila cari semula maklumat anda.');
  }

  if (!participant) return null;

  return recordLookupAndBuildResult(participant, session.id);
}

async function recordLookupAndBuildResult(participant: Participant, sessionId: string): Promise<PublicParticipantResult> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('record_participant_lookup', {
    p_participant_id: participant.id,
    p_session_id: sessionId,
  });

  if (error || !data) throw new Error('Maklumat tidak dapat direkodkan. Sila cuba semula.');
  return toPublicResult(participant, data, sessionId);
}

export async function confirmParticipantAttendance(participantId: string, sessionId: string): Promise<Pick<PublicParticipantResult, 'status' | 'confirmedAt'>> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('confirm_participant_attendance', {
    p_participant_id: participantId,
    p_session_id: sessionId,
  });

  if (error || !data) throw new Error('Kehadiran tidak dapat disahkan. Sila cuba semula.');
  return { status: 'Hadir Disahkan', confirmedAt: data.attendance_confirmed_at };
}
