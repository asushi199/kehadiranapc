'use client';

import { Radio } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { LiveAttendanceRow } from '@/lib/data/live-attendance';

interface LivePayload {
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

export function EmceeLiveList({ initialRows, initialSessionName, token }: { initialRows: LiveAttendanceRow[]; initialSessionName: string | null; token: string }) {
  const [rows, setRows] = useState(initialRows);
  const [sessionName, setSessionName] = useState(initialSessionName);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const sync = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(token)}/attendance`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as LivePayload;
      setRows(payload.rows);
      setSessionName(payload.sessionName);
      setLastUpdated(new Date());
    } catch {
      // Kekalkan paparan terakhir jika sambungan sementara terputus.
    }
  }, [token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => { void sync(); }, 2_000);
    return () => window.clearInterval(intervalId);
  }, [sync]);

  return (
    <main className="songket-surface min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-apc-gold/55 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.28em] text-apc-gold">APC 2025 · PAPARAN PENGACARA</p>
            <h1 className="mt-2 font-display text-3xl text-apc-ivory">Kehadiran Disahkan</h1>
            <p className="mt-2 text-sm text-apc-ivory/75">{sessionName ?? 'Tiada session aktif'}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-200">
            <Radio aria-hidden="true" className="size-4" />
            Langsung · dikemas kini {lastUpdated.toLocaleTimeString('ms-MY')}
          </div>
        </header>

        <div className="mt-5 text-sm">Hadir disahkan: <b className="text-2xl text-green-300">{rows.length}</b></div>

        <div className="attendance-table mt-6 overflow-x-auto border border-apc-gold/45">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-apc-royal text-apc-ivory"><tr>{['Bil', 'Nama', 'Sekolah / Unit', 'Kerusi', 'Kaunter', 'Masa Disahkan'].map((label) => <th className="px-3 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr className="border-t border-apc-gold/20" key={row.participantId}><td className="px-3 py-3">{row.bil}</td><td className="px-3 py-3 font-semibold">{row.name}</td><td className="px-3 py-3 text-apc-ivory/75">{row.organization}</td><td className="px-3 py-3">{row.seatNo}</td><td className="px-3 py-3">{row.counterNo}</td><td className="px-3 py-3 text-green-200">{formatConfirmedAt(row.confirmedAt)}</td></tr>)}</tbody>
          </table>
          {rows.length === 0 && <p className="p-5 text-center text-apc-ivory/70">Belum ada kehadiran yang disahkan.</p>}
        </div>
      </section>
    </main>
  );
}
