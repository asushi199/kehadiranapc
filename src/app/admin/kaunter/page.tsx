import Link from 'next/link';

import { AdminSignOut } from '@/components/admin/admin-sign-out';
import { CounterBoard } from '@/components/admin/counter-board';
import { requireStaffAccess } from '@/lib/auth/shared-access';
import { getCounterAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';

export default async function CounterBoardPage() {
  await requireStaffAccess();
  const snapshot = await getCounterAttendanceSnapshot(1);

  return (
    <main className="songket-surface min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.28em] text-apc-gold">APC 2025 · PAPARAN KAUNTER</p>
            <h1 className="mt-2 font-display text-3xl text-apc-ivory">Senarai Penerima Kaunter</h1>
          </div>
          <div className="flex items-center gap-3 text-sm"><Link className="text-apc-gold underline" href="/admin/dashboard">Dashboard</Link><AdminSignOut /></div>
        </header>
        <CounterBoard initialRows={snapshot.rows} initialSessionName={snapshot.sessionName} />
      </section>
    </main>
  );
}
