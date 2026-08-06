import { NextResponse } from 'next/server';

import { getConfirmedAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getConfirmedAttendanceSnapshot();
  return NextResponse.json(
    snapshot,
    { headers: { 'Cache-Control': 'public, no-store' } },
  );
}
