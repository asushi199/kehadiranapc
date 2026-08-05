import { notFound } from 'next/navigation';
import { AttendanceTable } from '@/components/admin/attendance-table';
import { LiveRefresh } from '@/components/admin/live-refresh';
import { getDashboardSnapshot } from '@/lib/data/dashboard';
import { getRequiredSecret } from '@/lib/env';

export default async function EmceeLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== getRequiredSecret('EMCEE_VIEW_TOKEN')) notFound();
  const snapshot = await getDashboardSnapshot();
  const confirmed = snapshot.rows.filter((row) => row.confirmed).length;
  return <main className="songket-surface min-h-screen px-4 py-6 sm:px-6"><section className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5"><div><p className="text-xs font-semibold tracking-[0.28em] text-apc-gold">APC 2025 · PAPARAN PENGACARA</p><h1 className="mt-2 font-display text-3xl text-apc-ivory">Status Kehadiran</h1></div><LiveRefresh /></header><div className="mt-5 flex gap-5 text-sm"><span>Jumlah: <b className="text-apc-gold">{snapshot.rows.length}</b></span><span>Hadir: <b className="text-green-300">{confirmed}</b></span></div><div className="mt-6"><AttendanceTable readOnly rows={snapshot.rows} /></div></section></main>;
}
