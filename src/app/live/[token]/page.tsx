import { notFound } from 'next/navigation';
import { EmceeLiveList } from '@/components/live/emcee-live-list';
import { getConfirmedAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';
import { getRequiredSecret } from '@/lib/env';

export default async function EmceeLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== getRequiredSecret('EMCEE_VIEW_TOKEN')) notFound();
  const snapshot = await getConfirmedAttendanceSnapshot();
  return <EmceeLiveList initialRows={snapshot.rows} initialSessionName={snapshot.sessionName} refreshUrl={`/api/live/${encodeURIComponent(token)}/attendance`} />;
}
