import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasStaffAccess, hasValidMasterPassword } from '@/lib/auth/shared-access';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const previewSchema = z.string().uuid();
const resetSchema = z.object({
  confirmation: z.literal('RESET APC 2025'),
  masterPassword: z.string().min(1).max(256),
  sessionId: z.string().uuid(),
}).strict();

async function getRehearsalSession(sessionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: session, error } = await supabase
    .from('event_sessions')
    .select('id, name, mode, is_active')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session) throw new Error('Session tidak ditemui.');
  if (session.mode !== 'rehearsal') throw new Error('Rekod Session rasmi tidak boleh direset.');
  return { session, supabase };
}

export async function GET(request: Request) {
  if (!(await hasStaffAccess())) {
    return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });
  }

  try {
    const sessionId = previewSchema.parse(new URL(request.url).searchParams.get('sessionId'));
    const { session, supabase } = await getRehearsalSession(sessionId);
    const { count, error } = await supabase
      .from('participant_activity')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id);
    if (error) throw new Error('Bilangan rekod tidak dapat disemak.');
    return NextResponse.json({ session, recordCount: count ?? 0 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Session tidak sah.' : error instanceof Error ? error.message : 'Semakan gagal.';
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await hasStaffAccess())) {
    return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });
  }

  try {
    const body = resetSchema.parse(await request.json());
    if (!hasValidMasterPassword(body.masterPassword)) {
      return NextResponse.json({ message: 'Master Password tidak sah.' }, { status: 403 });
    }

    const { session, supabase } = await getRehearsalSession(body.sessionId);
    const { data, error } = await supabase.rpc('reset_rehearsal_session', {
      p_actor: 'shared_staff',
      p_session_id: session.id,
    });
    if (error) throw new Error('Rekod latihan tidak dapat direset. Tiada rekod diubah.');
    const result = data[0];
    if (!result) throw new Error('Keputusan reset tidak diterima.');

    return NextResponse.json({
      backupId: result.backup_id,
      recordCount: result.record_count,
      sessionName: session.name,
    });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Maklumat reset tidak sah.' : error instanceof Error ? error.message : 'Reset gagal.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
