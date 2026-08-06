'use client';

import { useEffect, useState } from 'react';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export type AttendanceRefreshStatus = 'connecting' | 'live' | 'fallback';

const FALLBACK_INTERVAL_MS = 10_000;

export function useAttendanceRealtimeRefresh(refresh: () => void): AttendanceRefreshStatus {
  const [status, setStatus] = useState<AttendanceRefreshStatus>('connecting');

  useEffect(() => {
    let isMounted = true;
    let fallbackIntervalId: number | undefined;

    const startFallback = () => {
      if (fallbackIntervalId === undefined) {
        fallbackIntervalId = window.setInterval(() => { void refresh(); }, FALLBACK_INTERVAL_MS);
      }
      if (isMounted) setStatus('fallback');
    };

    const stopFallback = () => {
      if (fallbackIntervalId !== undefined) {
        window.clearInterval(fallbackIntervalId);
        fallbackIntervalId = undefined;
      }
    };

    let supabase: ReturnType<typeof createBrowserSupabaseClient>;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      startFallback();
      return () => {
        isMounted = false;
        stopFallback();
      };
    }

    const channel = supabase
      .channel('attendance-refresh-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_refresh_events' }, () => { void refresh(); })
      .subscribe((channelStatus) => {
        if (!isMounted) return;
        if (channelStatus === 'SUBSCRIBED') {
          stopFallback();
          setStatus('live');
          return;
        }
        if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') startFallback();
      });

    return () => {
      isMounted = false;
      stopFallback();
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return status;
}
