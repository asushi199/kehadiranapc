import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasStaffAccess, hasValidMasterPassword } from '@/lib/auth/shared-access';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const createSchema = z.object({
  action: z.literal('create'),
  masterPassword: z.string().min(1).max(256),
  mode: z.enum(['rehearsal', 'live']),
  name: z.string().trim().min(3).max(80),
}).strict();

const activateSchema = z.object({
  action: z.literal('activate'),
  masterPassword: z.string().min(1).max(256),
  sessionId: z.string().uuid(),
}).strict();

const requestSchema = z.discriminatedUnion('action', [createSchema, activateSchema]);

export async function POST(request: Request) {
  if (!(await hasStaffAccess())) {
    return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });
  }

  try {
    const body = requestSchema.parse(await request.json());
    if (!hasValidMasterPassword(body.masterPassword)) {
      return NextResponse.json({ message: 'Master Password tidak sah.' }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    if (body.action === 'create') {
      const { data, error } = await supabase
        .from('event_sessions')
        .insert({ name: body.name, mode: body.mode, is_active: false, starts_at: null, ends_at: null, created_by: null })
        .select('id, name, mode, is_active')
        .single();
      if (error) throw new Error(error.code === '23505' ? 'Nama Session telah digunakan.' : 'Session tidak dapat dicipta.');
      await supabase.from('audit_logs').insert({ user_id: null, action: 'session_created', target_type: 'event_session', target_id: data.id, metadata: { actor: 'shared_staff', name: data.name, mode: data.mode } });
      return NextResponse.json({ session: data });
    }

    const { data: target, error: targetError } = await supabase.from('event_sessions').select('id, name, mode').eq('id', body.sessionId).single();
    if (targetError || !target) throw new Error('Session tidak ditemui.');

    const { error: deactivateError } = await supabase.from('event_sessions').update({ is_active: false }).eq('is_active', true);
    if (deactivateError) throw new Error('Session aktif tidak dapat ditutup.');
    const { error: activateError } = await supabase.from('event_sessions').update({ is_active: true, starts_at: new Date().toISOString() }).eq('id', target.id);
    if (activateError) throw new Error('Session baharu tidak dapat diaktifkan.');
    await supabase.from('audit_logs').insert({ user_id: null, action: 'session_activated', target_type: 'event_session', target_id: target.id, metadata: { actor: 'shared_staff', name: target.name, mode: target.mode } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Maklumat Session tidak sah.' : error instanceof Error ? error.message : 'Operasi Session gagal.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
