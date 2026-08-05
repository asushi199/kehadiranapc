import Link from 'next/link';

import { requireStaffAccess } from '@/lib/auth/shared-access';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const actionLabels: Record<string, string> = {
  attendance_confirmed: 'Kehadiran disahkan oleh petugas',
  attendance_revoked: 'Pengesahan kehadiran dibatalkan',
  rehearsal_records_reset: 'Rekod latihan direset',
  session_activated: 'Session diaktifkan',
  session_created: 'Session dicipta',
};

const formatTime = (value: string) => new Intl.DateTimeFormat('ms-MY', {
  timeZone: 'Asia/Kuala_Lumpur',
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format(new Date(value));

const textValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : null;

function describeMetadata(metadata: Record<string, unknown>) {
  const details = [
    textValue(metadata.session_name) && `Session: ${textValue(metadata.session_name)}`,
    textValue(metadata.name) && `Session: ${textValue(metadata.name)}`,
    textValue(metadata.bil) && `Bil: ${textValue(metadata.bil)}`,
    textValue(metadata.counter_no) && `Kaunter: ${textValue(metadata.counter_no)}`,
    textValue(metadata.record_count) && `Rekod: ${textValue(metadata.record_count)}`,
    textValue(metadata.reason) && `Sebab: ${textValue(metadata.reason)}`,
  ].filter(Boolean);
  return details.length ? details.join(' · ') : 'Tiada butiran tambahan';
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffAccess();
  const params = await searchParams;
  const action = typeof params.action === 'string' && actionLabels[params.action] ? params.action : '';
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from('audit_logs')
    .select('id, action, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (action) query = query.eq('action', action);
  const { data: logs, error } = await query;
  if (error) throw new Error('Log audit tidak dapat dibaca.');

  return (
    <main className="songket-surface min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5">
          <div>
            <p className="text-xs tracking-[0.28em] text-apc-gold">APC 2025 · REKOD KESELAMATAN</p>
            <h1 className="mt-2 font-display text-3xl">Log Audit</h1>
          </div>
          <div className="flex gap-4 text-sm">
            <Link className="text-apc-gold underline" href="/admin/settings">Tetapan</Link>
            <Link className="text-apc-gold underline" href="/admin/dashboard">Dashboard</Link>
          </div>
        </header>

        <form className="mt-6 flex flex-wrap gap-3 border border-apc-gold/35 p-3" method="get">
          <select className="min-h-11 min-w-64 flex-1 bg-apc-ivory px-3 text-apc-navy" defaultValue={action} name="action">
            <option value="">Semua tindakan penting</option>
            {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="min-h-11 bg-apc-gold px-5 font-bold text-apc-navy" type="submit">TAPIS</button>
        </form>

        <p className="mt-4 text-sm text-apc-ivory/65">Memaparkan sehingga 100 rekod terkini · Waktu Malaysia</p>
        <div className="mt-4 space-y-3">
          {logs.map((log) => (
            <article className="border border-apc-gold/35 bg-apc-navy/80 p-4" key={log.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold text-apc-gold">{actionLabels[log.action] ?? log.action}</h2>
                <time className="text-xs text-apc-ivory/60">{formatTime(log.created_at)}</time>
              </div>
              <p className="mt-2 text-sm leading-6 text-apc-ivory/75">{describeMetadata(log.metadata)}</p>
            </article>
          ))}
          {!logs.length && <p className="border border-apc-gold/35 p-6 text-center text-apc-ivory/65">Tiada rekod audit untuk penapis ini.</p>}
        </div>
      </section>
    </main>
  );
}
