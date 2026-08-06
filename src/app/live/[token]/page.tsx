import { notFound } from 'next/navigation';
import { EmceeLiveList } from '@/components/live/emcee-live-list';
import { getConfirmedRows } from '@/lib/data/live-attendance';
import { getDashboardSnapshot } from '@/lib/data/dashboard';
import { getRequiredSecret } from '@/lib/env';

export default async function EmceeLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== getRequiredSecret('EMCEE_VIEW_TOKEN')) notFound();
  const snapshot = await getDashboardSnapshot();
  return <EmceeLiveList initialRows={getConfirmedRows(snapshot.rows)} initialSessionName={snapshot.session?.name ?? null} token={token} />;
}
