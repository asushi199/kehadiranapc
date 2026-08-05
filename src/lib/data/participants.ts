import 'server-only';

import type { AdminParticipantRow } from '@/types/app';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Participant } from '@/types/database';

export async function getActiveParticipantForAdmin(participantId: string): Promise<Participant | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error('Tidak dapat mendapatkan rekod penerima.');
  }

  return data;
}

export function toAdminParticipantRow(participant: Participant): AdminParticipantRow {
  return {
    participantId: participant.id,
    bil: participant.bil,
    name: participant.name,
    organization: participant.organization,
    seatNo: participant.seat_no,
    counterNo: participant.counter_no,
    firstLookupAt: null,
    attendanceStatus: 'not_confirmed',
    attendanceConfirmedAt: null,
    confirmationSource: null,
  };
}
