import { EmceeLiveList } from '@/components/live/emcee-live-list';
import { getConfirmedRows } from '@/lib/data/live-attendance';
import { getDashboardSnapshot } from '@/lib/data/dashboard';

export const dynamic = 'force-dynamic';

export default async function PublicEmceePage() {
  const snapshot = await getDashboardSnapshot();
  return <EmceeLiveList initialRows={getConfirmedRows(snapshot.rows)} initialSessionName={snapshot.session?.name ?? null} refreshUrl="/api/pengacara/attendance" />;
}
