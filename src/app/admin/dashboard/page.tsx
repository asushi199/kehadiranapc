import Link from 'next/link';

import { AdminSignOut } from '@/components/admin/admin-sign-out';
import { AttendanceTable } from '@/components/admin/attendance-table';
import { DashboardActions } from '@/components/admin/dashboard-actions';
import { LiveRefresh } from '@/components/admin/live-refresh';
import { requireStaffAccess } from '@/lib/auth/shared-access';
import { filterDashboardRows, normalizeDashboardFilters } from '@/lib/data/dashboard-filters';
import { getDashboardSnapshot } from '@/lib/data/dashboard';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffAccess();
  const snapshot = await getDashboardSnapshot();
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === 'string' ? params[key] : undefined);
  const filters = normalizeDashboardFilters(value('q'), value('counter'), value('status'));
  const rows = filterDashboardRows(snapshot.rows, filters);
  const confirmed = snapshot.rows.filter((row) => row.confirmed).length;
  const checked = snapshot.rows.filter((row) => row.checked).length;
  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set('q', filters.q);
  if (filters.counter) exportParams.set('counter', String(filters.counter));
  if (filters.status !== 'all') exportParams.set('status', filters.status);
  const exportQuery = exportParams.size ? `?${exportParams.toString()}` : '';

  return (
    <main className="songket-surface min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.28em] text-apc-gold">APC 2025 · PORTAL PENTADBIR</p>
            <h1 className="mt-2 font-display text-3xl text-apc-ivory">Dashboard</h1>
          </div>
          <div className="no-print flex items-center gap-3">
            <Link className="text-sm text-apc-gold underline" href="/admin/audit">Log Audit</Link>
            <Link className="text-sm text-apc-gold underline" href="/admin/settings">Tetapan Session</Link>
            <AdminSignOut />
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-apc-gold">
            {snapshot.session
              ? `${snapshot.session.name} · ${snapshot.session.mode === 'live' ? 'SESI SEBENAR' : 'MOD LATIHAN'}`
              : 'TIADA SESSION AKTIF'}
          </p>
          <div className="no-print"><LiveRefresh /></div>
        </div>

        <div className="no-print mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ['Jumlah Penerima', snapshot.rows.length],
            ['Telah Semak', checked],
            ['Hadir Disahkan', confirmed],
            ['Belum Hadir', snapshot.rows.length - confirmed],
          ].map(([label, metric]) => (
            <div className="border border-apc-gold/50 bg-apc-navy/85 p-4" key={String(label)}>
              <p className="text-xs text-apc-ivory/70">{label}</p>
              <p className="mt-2 font-display text-4xl text-apc-gold">{metric}</p>
            </div>
          ))}
        </div>

        <form className="no-print mt-6 grid gap-3 border border-apc-gold/35 p-3 sm:grid-cols-4" method="get">
          <input className="min-h-11 bg-apc-ivory px-3 text-apc-navy" defaultValue={filters.q} name="q" placeholder="Nama, Bil atau Sekolah / Unit" />
          <select className="min-h-11 bg-apc-ivory px-3 text-apc-navy" defaultValue={filters.counter || ''} name="counter">
            <option value="">Semua Kaunter</option>
            {[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>Kaunter {number}</option>)}
          </select>
          <select className="min-h-11 bg-apc-ivory px-3 text-apc-navy" defaultValue={filters.status} name="status">
            <option value="all">Semua Status</option>
            <option value="confirmed">Hadir Disahkan</option>
            <option value="checked">Telah Semak</option>
            <option value="unconfirmed">Belum Hadir</option>
          </select>
          <button className="min-h-11 bg-apc-gold font-bold text-apc-navy" type="submit">TAPIS</button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-apc-ivory/75">{rows.length} rekod dalam paparan semasa</p>
          <DashboardActions exportQuery={exportQuery} />
        </div>
        <div className="mt-4"><AttendanceTable rows={rows} /></div>
      </section>
    </main>
  );
}
