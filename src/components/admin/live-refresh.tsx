'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function LiveRefresh() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const refresh = useCallback(() => { router.refresh(); setLastUpdated(new Date()); }, [router]);
  useEffect(() => { const id = window.setInterval(refresh, 10_000); return () => window.clearInterval(id); }, [refresh]);
  return <div className="flex items-center gap-3 text-xs text-apc-ivory/75"><span>Auto kemas kini · {lastUpdated.toLocaleTimeString('ms-MY')}</span><button className="inline-flex min-h-9 items-center gap-1 border border-apc-gold/55 px-2 hover:bg-apc-royal" onClick={refresh} type="button"><RefreshCw className="size-3" /> MUAT SEMULA</button></div>;
}
