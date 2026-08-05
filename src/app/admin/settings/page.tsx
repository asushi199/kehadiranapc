import Link from 'next/link';

import { RehearsalReset } from '@/components/admin/rehearsal-reset';
import { SessionManager } from '@/components/admin/session-manager';
import { requireStaffAccess } from '@/lib/auth/shared-access';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export default async function SettingsPage() {
  await requireStaffAccess();
  const { data: sessions, error } = await createAdminSupabaseClient()
    .from('event_sessions')
    .select('id, name, mode, is_active')
    .order('created_at');
  if (error) throw new Error('Session tidak dapat dibaca.');
  const rehearsals = sessions.filter((session) => session.mode === 'rehearsal');

  return (
    <main className="songket-surface min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5">
          <div>
            <p className="text-xs tracking-[0.28em] text-apc-gold">APC 2025 · TETAPAN</p>
            <h1 className="mt-2 font-display text-3xl">Pengurusan Session</h1>
          </div>
          <div className="flex gap-4 text-sm">
            <Link className="text-apc-gold underline" href="/admin/audit">Log Audit</Link>
            <Link className="text-apc-gold underline" href="/admin/dashboard">Dashboard</Link>
          </div>
        </header>
        <div className="mt-6 space-y-8">
          <SessionManager sessions={sessions} />
          <RehearsalReset sessions={rehearsals} />
        </div>
      </section>
    </main>
  );
}
