'use client';

import { CheckCircle2, ChevronDown, CircleAlert, Search, UserRoundCheck } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { PublicParticipantResult, PublicSearchSuggestion } from '@/types/app';
import { getClientErrorMessage } from '@/lib/http/client-errors';

const noRecordMessage = 'Rekod tidak ditemui. Sila semak ejaan nama atau nombor Kad Pengenalan anda. Jika masih tidak berjaya, sila hubungi Urus Setia.';

type ApiSuccess<T> = T & { message?: string };
type ApiFailure = { message?: string };

function isIcInput(value: string): boolean {
  return /^[\d\s-]*$/.test(value);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiSuccess<T> & ApiFailure;

    if (!response.ok) {
      throw new Error(payload.message ?? 'Permintaan gagal. Cuba lagi.');
    }

    return payload as T;
  } catch (error) {
    throw new Error(getClientErrorMessage(error));
  }
}

export function SemakExperience() {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PublicSearchSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<PublicParticipantResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const icMode = useMemo(() => isIcInput(query), [query]);
  const icDigits = query.replace(/[\s-]/g, '');

  const clearResult = useCallback(() => {
    setResult(null);
    setMessage(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
  }, []);

  useEffect(() => {
    requestVersion.current += 1;
    const version = requestVersion.current;

    if (icMode || query.trim().length < 3) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await postJson<{ results: PublicSearchSuggestion[] }>('/api/public/search/name', { query });
        if (requestVersion.current === version) setSuggestions(response.results);
      } catch (error) {
        if (requestVersion.current === version) setMessage(error instanceof Error ? error.message : 'Carian tidak dapat dilakukan.');
      } finally {
        if (requestVersion.current === version) setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [icMode, query]);

  const lookup = useCallback(async (body: { ic: string } | { selectionToken: string }) => {
    setIsLookingUp(true);
    setMessage(null);
    try {
      const response = await postJson<{ result: PublicParticipantResult }>('/api/public/lookup', body);
      setResult(response.result);
      setSuggestions([]);
    } catch (error) {
      setResult(null);
      const errorMessage = error instanceof Error ? error.message : noRecordMessage;
      setMessage(errorMessage === 'Rekod tidak ditemui.' ? noRecordMessage : errorMessage);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setMessage(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setIsSearching(false);
    if (result) setResult(null);
  };

  const handleSubmit = () => {
    if (isLookingUp || isConfirming) return;
    if (icMode) {
      if (icDigits.length !== 12) {
        setMessage('Masukkan nombor Kad Pengenalan lengkap 12 digit untuk carian tepat.');
        return;
      }
      void lookup({ ic: query });
      return;
    }

    if (suggestions.length === 1) {
      void lookup({ selectionToken: suggestions[0].selectionToken });
      return;
    }

    setMessage('Pilih nama anda daripada senarai carian.');
  };

  const confirmAttendance = async () => {
    if (!result || isConfirming || result.status === 'Hadir Disahkan') return;
    setIsConfirming(true);
    setMessage(null);
    try {
      const response = await postJson<{ result: Pick<PublicParticipantResult, 'status' | 'confirmedAt'> }>(
        '/api/public/attendance/confirm',
        { lookupToken: result.lookupToken },
      );
      setResult((current) => (current ? { ...current, ...response.result } : current));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kehadiran tidak dapat disahkan.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (icMode || suggestions.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = suggestions[activeSuggestion] ?? (suggestions.length === 1 ? suggestions[0] : null);
      if (selected) void lookup({ selectionToken: selected.selectionToken });
      else handleSubmit();
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  if (result) {
    const isConfirmed = result.status === 'Hadir Disahkan';
    return (
      <main className="songket-surface min-h-screen px-4 py-7 sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-md">
          <header className="mb-5 text-center">
            <p className="text-xs font-semibold tracking-[0.28em] text-apc-gold">APC 2025</p>
            <h1 className="mt-2 font-display text-3xl text-apc-gold">{isConfirmed ? 'KEHADIRAN BERJAYA DISAHKAN' : 'TAHNIAH'}</h1>
          </header>

          {isConfirmed && (
            <div className="mb-4 flex items-center justify-center gap-2 border border-apc-success/70 bg-apc-success/15 px-4 py-3 text-center text-sm font-semibold text-green-200">
              <CheckCircle2 aria-hidden="true" className="size-5" /> Kehadiran telah direkodkan
            </div>
          )}

          <article className="border-2 border-apc-gold bg-apc-ivory p-5 text-apc-navy shadow-2xl shadow-black/30">
            <p className="text-center text-xs font-semibold tracking-[0.22em] text-apc-royal/70">MAKLUMAT PENERIMA</p>
            <h2 className="mt-3 text-center font-display text-2xl leading-tight">{result.name}</h2>
            <p className="mt-2 text-center text-sm leading-5 text-apc-royal">{result.organization}</p>
            <div className="my-5 border-t border-apc-gold/65" />
            <dl className="grid grid-cols-2 gap-4 text-center">
              <div className="border-r border-apc-gold/60 pr-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-apc-royal">No. Penerima</dt>
                <dd className="mt-1 font-display text-5xl leading-none">{result.bil}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-apc-royal">No. Kerusi</dt>
                <dd className="mt-1 font-display text-5xl leading-none">{result.seatNo}</dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-apc-gold/65 pt-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-apc-royal">Kaunter</p>
              <p className="mt-1 font-display text-6xl leading-none">{result.counterNo}</p>
            </div>
            <p className="mt-4 text-center text-xs text-apc-royal/75">Kad Pengenalan: {result.maskedIc}</p>
          </article>

          <p className="mt-4 border border-apc-gold/65 bg-apc-navy/85 px-4 py-3 text-center text-sm leading-5 text-apc-ivory">
            Sila hadir ke <span className="font-semibold text-apc-gold">Kaunter {result.counterNo}</span> untuk urusan penerimaan sijil.
          </p>

          {message && <Notice message={message} />}

          {isConfirmed ? (
            <div className="mt-5 text-center">
              <p className="flex items-center justify-center gap-2 text-sm text-green-200"><CheckCircle2 aria-hidden="true" className="size-4" /> Disahkan pada {formatDateTime(result.confirmedAt)}</p>
              <p className="mt-5 text-sm leading-6 text-apc-ivory/85">Terima kasih. Sila simpan paparan ini sebagai rujukan.</p>
            </div>
          ) : (
            <button
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border border-apc-gold bg-apc-gold px-5 py-3 text-sm font-bold tracking-wide text-apc-navy transition-colors hover:bg-apc-ivory disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apc-gold"
              disabled={isConfirming}
              onClick={confirmAttendance}
              type="button"
            >
              <UserRoundCheck aria-hidden="true" className="size-5" />
              {isConfirming ? 'SEDANG MENGESAHKAN...' : 'SAHKAN KEHADIRAN'}
            </button>
          )}

          <button className="mt-4 min-h-12 w-full text-sm font-semibold text-apc-ivory underline underline-offset-4 disabled:opacity-50" disabled={isConfirming} onClick={clearResult} type="button">
            CARI SEMULA
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="songket-surface flex min-h-screen items-center px-4 py-7 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-md border border-apc-gold/65 bg-apc-navy/95 px-5 py-8 shadow-2xl shadow-black/30 sm:px-7">
        <header className="text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-apc-gold">APC 2025</p>
          <h1 className="mt-4 font-display text-3xl leading-tight text-apc-gold sm:text-4xl">Majlis Anugerah Perkhidmatan Cemerlang 2025</h1>
          <div className="mx-auto my-5 h-px w-20 bg-apc-gold/80" />
          <p className="text-sm leading-6 text-apc-ivory/85">Semak nombor penerima, tempat duduk dan kaunter anda.</p>
        </header>

        <div className="relative mt-7">
          <label className="sr-only" htmlFor={inputId}>Masukkan nama atau nombor Kad Pengenalan</label>
          <div className="flex min-h-12 items-center border border-apc-gold bg-apc-ivory px-3 text-apc-navy focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-apc-gold">
            <Search aria-hidden="true" className="mr-2 size-5 shrink-0" />
            <input
              aria-activedescendant={activeSuggestion >= 0 ? `${inputId}-option-${activeSuggestion}` : undefined}
              aria-autocomplete="list"
              aria-controls={`${inputId}-listbox`}
              aria-expanded={suggestions.length > 0}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-apc-royal/65"
              id={inputId}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Masukkan nama atau No. Kad Pengenalan"
              role="combobox"
              value={query}
            />
            <ChevronDown aria-hidden="true" className="size-5 text-apc-royal/70" />
          </div>

          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full overflow-hidden border border-apc-gold/75 bg-apc-navy shadow-xl" id={`${inputId}-listbox`} role="listbox">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.selectionToken} role="option" aria-selected={activeSuggestion === index}>
                  <button
                    className={`w-full border-b border-apc-gold/25 px-4 py-3 text-left last:border-b-0 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-apc-gold ${activeSuggestion === index ? 'bg-apc-royal' : 'hover:bg-apc-royal/75'}`}
                    id={`${inputId}-option-${index}`}
                    onClick={() => void lookup({ selectionToken: suggestion.selectionToken })}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-apc-ivory">{suggestion.name}</span>
                    <span className="mt-1 flex justify-between gap-3 text-xs text-apc-ivory/75"><span className="truncate">{suggestion.organization}</span><span className="shrink-0">******-**-{suggestion.icLast4}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-apc-ivory/75">
          {icMode ? 'Masukkan 12 digit penuh untuk carian Kad Pengenalan yang tepat.' : 'Taip sekurang-kurangnya 3 huruf untuk carian nama.'}
        </p>
        {message && <Notice message={message} />}

        <button
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border border-apc-gold bg-apc-gold px-5 py-3 text-sm font-bold tracking-wide text-apc-navy transition-colors hover:bg-apc-ivory disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apc-gold"
          disabled={isLookingUp || isConfirming || isSearching}
          onClick={handleSubmit}
          type="button"
        >
          <Search aria-hidden="true" className="size-5" />
          {isLookingUp ? 'SEDANG MENYEMAK...' : 'SEMAK MAKLUMAT'}
        </button>
      </section>
    </main>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <p aria-live="polite" className="mt-4 flex gap-2 border border-amber-300/55 bg-amber-200/10 px-3 py-3 text-sm leading-5 text-amber-100">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> {message}
    </p>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return 'baru sahaja';
  return new Intl.DateTimeFormat('ms-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(value));
}
