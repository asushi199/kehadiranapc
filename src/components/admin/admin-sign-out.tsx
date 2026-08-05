'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';

export function AdminSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const signOut = async () => {
    setIsSigningOut(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/access/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Log keluar gagal. Cuba lagi.');
      router.replace('/admin/login');
      router.refresh();
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="text-right">
      <button className="inline-flex min-h-10 items-center gap-2 border border-apc-gold/65 px-3 text-xs font-bold text-apc-ivory hover:bg-apc-royal disabled:opacity-60" disabled={isSigningOut} onClick={() => void signOut()} type="button">
        <LogOut aria-hidden="true" className="size-4" /> {isSigningOut ? 'KELUAR...' : 'KELUAR'}
      </button>
      {message && <p aria-live="polite" className="mt-2 max-w-64 text-xs text-amber-200">{message}</p>}
    </div>
  );
}
