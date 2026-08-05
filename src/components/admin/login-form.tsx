'use client';

import { KeyRound, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/access/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setErrorMessage('Log masuk tidak berjaya. Sila semak kata laluan.');
        return;
      }

      router.replace('/admin/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage(getClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-7 space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-semibold text-apc-ivory" htmlFor="password">
        Kata laluan petugas
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full border border-apc-gold/65 bg-apc-ivory px-3 text-apc-navy outline-none focus:border-apc-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apc-gold"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>

      {errorMessage && <p aria-live="polite" className="border border-amber-300/55 bg-amber-200/10 px-3 py-3 text-sm text-amber-100">{errorMessage}</p>}

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 border border-apc-gold bg-apc-gold px-4 py-3 text-sm font-bold tracking-wide text-apc-navy transition-colors hover:bg-apc-ivory disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apc-gold"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <KeyRound aria-hidden="true" className="size-5" /> : <LogIn aria-hidden="true" className="size-5" />}
        {isSubmitting ? 'SEDANG LOG MASUK...' : 'LOG MASUK'}
      </button>
    </form>
  );
}
