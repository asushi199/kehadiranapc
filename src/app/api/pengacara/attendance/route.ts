import { NextResponse } from 'next/server';

import { getConfirmedRows } from '@/lib/data/live-attendance';
import { getDashboardSnapshot } from '@/lib/data/dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getDashboardSnapshot();
  return NextResponse.json(
    { rows: getConfirmedRows(snapshot.rows), sessionName: snapshot.session?.name ?? null },
    { headers: { 'Cache-Control': 'public, no-store' } },
  );
}
