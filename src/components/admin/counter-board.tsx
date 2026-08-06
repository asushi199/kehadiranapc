'use client';

import { Radio } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { LiveAttendanceRow } from '@/lib/data/live-attendance';

interface CounterPayload {
  rows: LiveAttendanceRow[];
  sessionName: string | null;
}

function formatConfirmedAt(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ms-MY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(value));
}

export function CounterBoard({ initialRows, initialSessionName }: { initialRows: LiveAttendanceRow[]; initialSessionName: string | null }) {
  const [counterNo, setCounterNo] = useState(1);
  const [rows, setRows] = useState(initialRows);
  const [sessionName, setSessionName] = useState(initialSessionName);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const sync = useCallback(async (selectedCounterNo: number) => {
    try {
      const response = await fetch(`/api/admin/counter-board?counter=${selectedCounterNo}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as CounterPayload;
      setRows(payload.rows);
      setSessionName(payload.sessionName);
      setLastUpdated(new Date());
    } catch {
      // Kekalkan senarai terakhir jika sambungan sementara terputus.
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => { void sync(counterNo); }, 2_000);
    return () => window.clearInterval(intervalId);
  }, [counterNo, sync]);

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <label className="text-sm font-semibold">Pilih Kaunter
          <select className="ml-3 min-h-11 bg-apc-ivory px-3 text-apc-navy" onChange={(event) => { const nextCounterNo = Number(event.target.value); setRows([]); setCounterNo(nextCounterNo); void sync(nextCounterNo); }} value={counterNo}>
            {[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>Kaunter {number}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs text-green-200"><Radio aria-hidden="true" className="size-4" /> Langsung · dikemas kini {lastUpdated.toLocaleTimeString('ms-MY')}</div>
      </div>
      <p className="mt-3 text-sm text-apc-gold">{sessionName ?? 'Tiada session aktif'} · {rows.length} penerima</p>

      <div className="attendance-table mt-5 overflow-x-auto border border-apc-gold/45">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-apc-royal text-apc-ivory"><tr>{['Bil', 'Nama', 'Sekolah / Unit', 'Kerusi', 'Status', 'Masa Disahkan'].map((label) => <th className="px-3 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr className="border-t border-apc-gold/20" key={row.participantId}><td className="px-3 py-3">{row.bil}</td><td className="px-3 py-3 font-semibold">{row.name}</td><td className="px-3 py-3 text-apc-ivory/75">{row.organization}</td><td className="px-3 py-3">{row.seatNo}</td><td className={`px-3 py-3 font-semibold ${row.confirmed ? 'text-green-300' : 'text-apc-ivory/70'}`}>{row.confirmed ? 'Hadir Disahkan' : 'Belum Disahkan'}</td><td className="px-3 py-3">{formatConfirmedAt(row.confirmedAt)}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-5 text-center text-apc-ivory/70">Tiada penerima untuk dipaparkan.</p>}
      </div>
    </div>
  );
}
