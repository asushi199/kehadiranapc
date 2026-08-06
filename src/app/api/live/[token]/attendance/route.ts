import { NextResponse } from 'next/server';

import { getConfirmedAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';
import { getRequiredSecret } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== getRequiredSecret('EMCEE_VIEW_TOKEN')) return NextResponse.json({ message: 'Tidak ditemui.' }, { status: 404 });

  const snapshot = await getConfirmedAttendanceSnapshot();
  return NextResponse.json(
    snapshot,
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
