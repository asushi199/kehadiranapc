'use client';

import { Radio } from 'lucide-react';
import { useCallback, useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';
import type { LiveAttendanceRow } from '@/lib/data/live-attendance';
import { useAttendanceRealtimeRefresh } from '@/components/live/use-attendance-realtime-refresh';

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
  const [pendingParticipantId, setPendingParticipantId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const refresh = useCallback(() => { void sync(counterNo); }, [counterNo, sync]);
  const refreshStatus = useAttendanceRealtimeRefresh(refresh);

  const confirmAttendance = async (participantId: string) => {
    setPendingParticipantId(participantId);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', participantId }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Kehadiran tidak dapat disahkan.');
      await sync(counterNo);
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setPendingParticipantId(null);
    }
  };

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <label className="text-sm font-semibold">Pilih Kaunter
          <select className="ml-3 min-h-11 bg-apc-ivory px-3 text-apc-navy" onChange={(event) => { const nextCounterNo = Number(event.target.value); setRows([]); setCounterNo(nextCounterNo); void sync(nextCounterNo); }} value={counterNo}>
            {[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>Kaunter {number}</option>)}
          </select>
        </label>
        <div className={`flex items-center gap-2 text-xs ${refreshStatus === 'live' ? 'text-green-200' : 'text-amber-100'}`}>
          <Radio aria-hidden="true" className="size-4" />
          {refreshStatus === 'live'
            ? `Langsung · dikemas kini ${lastUpdated.toLocaleTimeString('ms-MY')}`
            : refreshStatus === 'fallback'
              ? 'Sambungan Realtime terganggu · semak setiap 10 saat'
              : 'Menyambung Realtime...'}
        </div>
      </div>
      <p className="mt-3 text-sm text-apc-gold">{sessionName ?? 'Tiada session aktif'} · {rows.length} penerima</p>
      {message && <p className="mt-3 border border-amber-300/50 px-3 py-3 text-sm text-amber-100">{message}</p>}

      <div className="attendance-table mt-5 overflow-x-auto border border-apc-gold/45">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-apc-royal text-apc-ivory"><tr>{['Bil', 'Nama', 'Sekolah / Unit', 'Kerusi', 'Status', 'Masa Disahkan', 'Tindakan'].map((label) => <th className="px-3 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr className="border-t border-apc-gold/20" key={row.participantId}><td className="px-3 py-3">{row.bil}</td><td className="px-3 py-3 font-semibold">{row.name}</td><td className="px-3 py-3 text-apc-ivory/75">{row.organization}</td><td className="px-3 py-3">{row.seatNo}</td><td className={`px-3 py-3 font-semibold ${row.confirmed ? 'text-green-300' : 'text-apc-ivory/70'}`}>{row.confirmed ? 'Hadir Disahkan' : 'Belum Disahkan'}</td><td className="px-3 py-3">{formatConfirmedAt(row.confirmedAt)}</td><td className="px-3 py-3">{row.confirmed ? <span className="text-xs font-semibold text-green-300">SELESAI</span> : <button className="min-h-10 border border-apc-gold/60 px-3 text-xs font-bold disabled:opacity-50" disabled={pendingParticipantId === row.participantId} onClick={() => void confirmAttendance(row.participantId)} type="button">{pendingParticipantId === row.participantId ? 'MEMPROSES...' : 'SAHKAN'}</button>}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-5 text-center text-apc-ivory/70">Tiada penerima untuk dipaparkan.</p>}
      </div>
    </div>
  );
}
