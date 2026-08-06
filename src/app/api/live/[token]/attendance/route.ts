import { NextResponse } from 'next/server';

import { getConfirmedRows } from '@/lib/data/live-attendance';
import { getDashboardSnapshot } from '@/lib/data/dashboard';
import { getRequiredSecret } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== getRequiredSecret('EMCEE_VIEW_TOKEN')) return NextResponse.json({ message: 'Tidak ditemui.' }, { status: 404 });

  const snapshot = await getDashboardSnapshot();
  return NextResponse.json(
    { rows: getConfirmedRows(snapshot.rows), sessionName: snapshot.session?.name ?? null },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
