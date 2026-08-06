import { NextResponse } from 'next/server';

import { hasStaffAccess } from '@/lib/auth/shared-access';
import { getCounterRows } from '@/lib/data/live-attendance';
import { getDashboardSnapshot } from '@/lib/data/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasStaffAccess())) return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });

  const counterNo = Number(new URL(request.url).searchParams.get('counter'));
  if (!Number.isInteger(counterNo) || counterNo < 1 || counterNo > 6) {
    return NextResponse.json({ message: 'Kaunter tidak sah.' }, { status: 400 });
  }

  const snapshot = await getDashboardSnapshot();
  return NextResponse.json(
    { rows: getCounterRows(snapshot.rows, counterNo), sessionName: snapshot.session?.name ?? null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
