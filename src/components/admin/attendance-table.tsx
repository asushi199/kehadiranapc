'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DashboardRow } from '@/lib/data/dashboard';
import { getClientErrorMessage } from '@/lib/http/client-errors';

export function AttendanceTable({ rows, readOnly = false }: { rows: DashboardRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const act = async (row: DashboardRow) => {
    const action = row.confirmed ? 'revoke' : 'confirm';
    const reason = action === 'revoke' ? window.prompt('Nyatakan sebab pembatalan kehadiran:') : undefined;
    if (action === 'revoke' && (!reason || reason.trim().length < 3)) return;
    setPending(row.participantId); setMessage(null);
    try {
      const response = await fetch('/api/admin/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, participantId: row.participantId, ...(reason ? { reason } : {}) }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Tindakan gagal.');
      router.refresh();
    } catch (error) { setMessage(getClientErrorMessage(error)); }
    finally { setPending(null); }
  };
  return <div>{message && <p className="no-print mb-3 border border-amber-300/50 p-3 text-sm text-amber-100">{message}</p>}<div className="attendance-table overflow-x-auto border border-apc-gold/45"><table className="min-w-full text-left text-sm"><thead className="bg-apc-royal text-apc-ivory"><tr>{['Bil', 'Nama', 'Sekolah / Unit', 'Kerusi', 'Kaunter', 'Status'].map((label) => <th className="px-3 py-3 font-semibold" key={label}>{label}</th>)}{!readOnly && <th className="no-print px-3 py-3 font-semibold">Tindakan</th>}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-apc-gold/20" key={row.bil}><td className="px-3 py-3">{row.bil}</td><td className="px-3 py-3 font-semibold">{row.name}</td><td className="px-3 py-3 text-apc-ivory/75">{row.organization}</td><td className="px-3 py-3">{row.seatNo}</td><td className="px-3 py-3">{row.counterNo}</td><td className="px-3 py-3"><span className={row.confirmed ? 'text-green-300' : row.checked ? 'text-amber-200' : 'text-apc-ivory/65'}>{row.confirmed ? 'Hadir Disahkan' : row.checked ? 'Telah Semak' : 'Belum Semak'}</span></td>{!readOnly && <td className="no-print px-3 py-2"><button className="min-h-10 border border-apc-gold/55 px-2 text-xs disabled:opacity-50" disabled={pending === row.participantId} onClick={() => void act(row)} type="button">{pending === row.participantId ? 'MEMPROSES...' : row.confirmed ? 'BATALKAN' : 'SAHKAN'}</button></td>}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-5 text-center text-apc-ivory/70">Tiada rekod untuk dipaparkan.</p>}</div></div>;
}
