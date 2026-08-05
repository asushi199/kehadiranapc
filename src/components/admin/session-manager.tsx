'use client';

import { CalendarPlus, Power } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';
import type { EventSession } from '@/types/database';

type SessionSummary = Pick<EventSession, 'id' | 'is_active' | 'mode' | 'name'>;

export function SessionManager({ sessions }: { sessions: SessionSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'rehearsal' | 'live'>('rehearsal');
  const [masterPassword, setMasterPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (body: object, actionKey: string) => {
    setPendingAction(actionKey);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, masterPassword }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Operasi gagal.');
      setMessage('Perubahan Session berjaya disimpan.');
      setName('');
      router.refresh();
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  return <div className="space-y-6">
    <section className="border border-apc-gold/50 bg-apc-navy/85 p-5">
      <h2 className="font-display text-2xl text-apc-gold">Cipta Session</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input className="min-h-12 bg-apc-ivory px-3 text-apc-navy" onChange={(event) => setName(event.target.value)} placeholder="Contoh: LATIHAN 1" value={name} />
        <select className="min-h-12 bg-apc-ivory px-3 text-apc-navy" onChange={(event) => setMode(event.target.value as 'rehearsal' | 'live')} value={mode}><option value="rehearsal">MOD LATIHAN</option><option value="live">SESI SEBENAR</option></select>
        <button className="min-h-12 bg-apc-gold px-4 font-bold text-apc-navy disabled:opacity-50" disabled={Boolean(pendingAction) || name.trim().length < 3 || !masterPassword} onClick={() => void submit({ action: 'create', name, mode }, 'create')} type="button"><CalendarPlus className="mr-2 inline size-4" />CIPTA SESSION</button>
      </div>
    </section>
    <label className="block text-sm font-semibold">Master Password<input className="mt-2 min-h-12 w-full max-w-md bg-apc-ivory px-3 text-apc-navy" onChange={(event) => setMasterPassword(event.target.value)} type="password" value={masterPassword} /></label>
    {message && <p aria-live="polite" className="border border-apc-gold/45 px-3 py-3 text-sm">{message}</p>}
    <section className="space-y-3">{sessions.map((session) => <div className={`flex flex-wrap items-center justify-between gap-3 border p-4 ${session.is_active ? 'border-green-400 bg-green-950/25' : 'border-apc-gold/35'}`} key={session.id}><div><p className="font-semibold">{session.name}</p><p className="mt-1 text-xs text-apc-ivory/65">{session.mode === 'live' ? 'SESI SEBENAR' : 'MOD LATIHAN'} {session.is_active ? '· AKTIF' : ''}</p></div><button className="min-h-10 border border-apc-gold/60 px-3 text-xs font-bold disabled:opacity-50" disabled={session.is_active || Boolean(pendingAction) || !masterPassword} onClick={() => void submit({ action: 'activate', sessionId: session.id }, session.id)} type="button"><Power className="mr-1 inline size-4" />AKTIFKAN</button></div>)}</section>
  </div>;
}
