'use client';

import { useState } from 'react';

import { getClientErrorMessage } from '@/lib/http/client-errors';

export function DashboardActions({ exportQuery }: { exportQuery: string }) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const exportCsv = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/export${exportQuery}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? 'Eksport CSV gagal.');
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'APC-2025-senarai-ditapis.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setMessage(getClientErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center justify-end gap-2">
      {message && <p className="w-full text-right text-sm text-amber-200" role="alert">{message}</p>}
      <button className="min-h-10 border border-apc-gold/60 px-4 text-sm font-semibold text-apc-gold" onClick={() => window.print()} type="button">
        CETAK
      </button>
      <button className="min-h-10 bg-apc-gold px-4 text-sm font-bold text-apc-navy disabled:opacity-50" disabled={exporting} onClick={() => void exportCsv()} type="button">
        {exporting ? 'MENGEKSPORT...' : 'EKSPORT CSV'}
      </button>
    </div>
  );
}
