import { EmceeLiveList } from '@/components/live/emcee-live-list';
import { getConfirmedAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';

export const dynamic = 'force-dynamic';

export default async function PublicEmceePage() {
  const snapshot = await getConfirmedAttendanceSnapshot();
  return <EmceeLiveList initialRows={snapshot.rows} initialSessionName={snapshot.sessionName} refreshUrl="/api/pengacara/attendance" />;
}
