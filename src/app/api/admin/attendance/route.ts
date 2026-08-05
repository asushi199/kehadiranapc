import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasStaffAccess } from '@/lib/auth/shared-access';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), participantId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('revoke'), participantId: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).strict(),
]);

export async function POST(request: Request) {
  if (!(await hasStaffAccess())) return NextResponse.json({ message: 'Sesi petugas telah tamat.' }, { status: 401 });
  try {
    const body = requestSchema.parse(await request.json());
    const supabase = createAdminSupabaseClient();
    const { data: session } = await supabase.from('event_sessions').select('id').eq('is_active', true).maybeSingle();
    if (!session) throw new Error('Tiada Session aktif.');
    const { data: participant } = await supabase.from('participants').select('id, bil, counter_no').eq('id', body.participantId).eq('is_active', true).maybeSingle();
    if (!participant) throw new Error('Penerima tidak ditemui.');
    const { data: current } = await supabase.from('participant_activity').select('*').eq('participant_id', participant.id).eq('session_id', session.id).maybeSingle();

    if (body.action === 'confirm') {
      if (current?.attendance_status === 'confirmed') return NextResponse.json({ ok: true });
      const now = new Date().toISOString();
      if (current) {
        const { error } = await supabase
          .from('participant_activity')
          .update({
            attendance_status: 'confirmed',
            attendance_confirmed_at: now,
            confirmation_source: 'staff',
            confirmed_by: null,
          })
          .eq('id', current.id);
        if (error) throw new Error('Kehadiran tidak dapat disahkan.');
      } else {
        const { error } = await supabase.from('participant_activity').insert({
          participant_id: participant.id,
          session_id: session.id,
          first_lookup_at: null,
          last_lookup_at: null,
          lookup_count: 0,
          attendance_status: 'confirmed',
          attendance_confirmed_at: now,
          confirmation_source: 'staff',
          confirmed_by: null,
        });
        if (error) throw new Error('Kehadiran tidak dapat disahkan.');
      }
      await supabase.from('audit_logs').insert({ user_id: null, action: 'attendance_confirmed', target_type: 'participant', target_id: participant.id, metadata: { actor: 'shared_staff', bil: participant.bil, counter_no: participant.counter_no, session_id: session.id } });
    } else {
      if (!current || current.attendance_status !== 'confirmed') throw new Error('Kehadiran belum disahkan.');
      const { error } = await supabase.from('participant_activity').update({ attendance_status: 'not_confirmed', attendance_confirmed_at: null, confirmation_source: null, confirmed_by: null }).eq('id', current.id);
      if (error) throw new Error('Pengesahan tidak dapat dibatalkan.');
      await supabase.from('audit_logs').insert({ user_id: null, action: 'attendance_revoked', target_type: 'participant', target_id: participant.id, metadata: { actor: 'shared_staff', bil: participant.bil, counter_no: participant.counter_no, session_id: session.id, reason: body.reason } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Maklumat tindakan tidak sah.' : error instanceof Error ? error.message : 'Tindakan gagal.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
