import 'server-only';

import { headers } from 'next/headers';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createLookupSecretHmac } from '@/lib/security/hmac';

function currentWindowStart(windowMs: number): string {
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
}

export async function enforceRateLimit(route: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for');
  const source = forwardedFor?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown';
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_route: route,
    p_key_hmac: createLookupSecretHmac(source),
    p_window_starts_at: currentWindowStart(windowMs),
    p_limit: limit,
  });

  if (error) {
    throw new Error('Tidak dapat menyemak had permintaan.');
  }

  return data;
}
