'use client';

import { RotateCcw, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';

interface RehearsalSession {
  id: string;
  is_active: boolean;
  name: string;
}

interface Preview {
  recordCount: number;
  session: RehearsalSession;
}

export function RehearsalReset({ sessions }: { sessions: RehearsalSession[] }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState<'preview' | 'reset' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewReset = async () => {
    setPending('preview');
    setMessage(null);
    setPreview(null);
    try {
      const response = await fetch(`/api/admin/rehearsal-reset?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const payload = await response.json() as Preview & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Semakan gagal.');
      setPreview(payload);
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  const resetRecords = async () => {
    if (!preview) return;
    setPending('reset');
    setMessage(null);
    try {
      const response = await fetch('/api/admin/rehearsal-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: preview.session.id, masterPassword, confirmation }),
      });
      const payload = await response.json() as { message?: string; recordCount?: number; sessionName?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Reset gagal.');
      setMessage(`${payload.recordCount ?? 0} rekod ${payload.sessionName ?? ''} telah diarkib dan direset.`);
      setPreview(null);
      setMasterPassword('');
      setConfirmation('');
      router.refresh();
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="border border-red-300/50 bg-red-950/20 p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 size-5 shrink-0 text-red-200" />
        <div>
          <h2 className="font-display text-2xl text-red-100">Reset Rekod Latihan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-apc-ivory/75">Rekod akan disalin ke arkib terlebih dahulu. Session rasmi tidak boleh dipilih atau direset.</p>
        </div>
      </div>

      {sessions.length ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select className="min-h-12 bg-apc-ivory px-3 text-apc-navy" disabled={Boolean(pending)} onChange={(event) => { setSessionId(event.target.value); setPreview(null); setMessage(null); }} value={sessionId}>
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_active ? ' · AKTIF' : ''}</option>)}
            </select>
            <button className="min-h-12 border border-red-200/65 px-4 text-sm font-bold text-red-100 disabled:opacity-50" disabled={Boolean(pending) || !sessionId} onClick={() => void previewReset()} type="button">
              {pending === 'preview' ? 'MENYEMAK...' : 'SEMAK REKOD'}
            </button>
          </div>

          {preview && (
            <div className="border border-red-200/45 bg-apc-navy/75 p-4">
              <p className="text-sm text-apc-ivory/75">Session yang akan direset</p>
              <p className="mt-1 font-semibold text-red-100">{preview.session.name}</p>
              <p className="mt-4 font-display text-4xl text-red-100">{preview.recordCount}</p>
              <p className="text-sm text-apc-ivory/75">rekod akan diarkib dan dikeluarkan daripada statistik Session ini</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Masukkan semula Master Password
                  <input autoComplete="current-password" className="mt-2 min-h-12 w-full bg-apc-ivory px-3 text-apc-navy" disabled={Boolean(pending)} onChange={(event) => setMasterPassword(event.target.value)} type="password" value={masterPassword} />
                </label>
                <label className="text-sm font-semibold">Taip <span className="text-red-100">RESET APC 2025</span>
                  <input autoComplete="off" className="mt-2 min-h-12 w-full bg-apc-ivory px-3 text-apc-navy" disabled={Boolean(pending)} onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
                </label>
              </div>
              <button className="mt-5 min-h-12 bg-red-200 px-5 font-bold text-red-950 disabled:opacity-40" disabled={Boolean(pending) || preview.recordCount === 0 || !masterPassword || confirmation !== 'RESET APC 2025'} onClick={() => void resetRecords()} type="button">
                <RotateCcw className="mr-2 inline size-4" />{pending === 'reset' ? 'SEDANG RESET...' : `RESET ${preview.recordCount} REKOD`}
              </button>
            </div>
          )}
        </div>
      ) : <p className="mt-4 text-sm text-apc-ivory/70">Tiada Session latihan tersedia.</p>}

      {message && <p aria-live="polite" className="mt-4 border border-apc-gold/45 px-3 py-3 text-sm">{message}</p>}
    </section>
  );
}
