import { NextResponse } from 'next/server';

import { hasStaffAccess } from '@/lib/auth/shared-access';
import { filterDashboardRows, normalizeDashboardFilters } from '@/lib/data/dashboard-filters';
import { getDashboardSnapshot } from '@/lib/data/dashboard';

const csvCell = (value: string | number) => {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const formatKualaLumpurTime = (value: string | null) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
};

export async function GET(request: Request) {
  if (!(await hasStaffAccess())) {
    return NextResponse.json({ message: 'Sesi petugas telah tamat. Sila log masuk semula.' }, { status: 401 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const filters = normalizeDashboardFilters(
      searchParams.get('q') ?? undefined,
      searchParams.get('counter') ?? undefined,
      searchParams.get('status') ?? undefined,
    );
    const snapshot = await getDashboardSnapshot();
    const rows = filterDashboardRows(snapshot.rows, filters);
    const header = ['Bil', 'Nama', 'Sekolah / Unit', 'Kerusi', 'Kaunter', 'Status', 'Masa Disahkan'];
    const csvRows = rows.map((row) => [
      row.bil,
      row.name,
      row.organization,
      row.seatNo,
      row.counterNo,
      row.confirmed ? 'Hadir Disahkan' : row.checked ? 'Telah Semak' : 'Belum Semak',
      formatKualaLumpurTime(row.confirmedAt),
    ]);
    const csv = `\uFEFF${[header, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;

    return new Response(csv, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="APC-2025-senarai-ditapis.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Senarai tidak dapat dieksport. Cuba lagi.' }, { status: 500 });
  }
}
