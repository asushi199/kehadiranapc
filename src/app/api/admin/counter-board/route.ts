import { NextResponse } from 'next/server';

import { hasStaffAccess } from '@/lib/auth/shared-access';
import { getCounterAttendanceSnapshot } from '@/lib/data/live-attendance-snapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasStaffAccess())) return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });

  const counterNo = Number(new URL(request.url).searchParams.get('counter'));
  if (!Number.isInteger(counterNo) || counterNo < 1 || counterNo > 6) {
    return NextResponse.json({ message: 'Kaunter tidak sah.' }, { status: 400 });
  }

  const snapshot = await getCounterAttendanceSnapshot(counterNo);
  return NextResponse.json(
    snapshot,
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
