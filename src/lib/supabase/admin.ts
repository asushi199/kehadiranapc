import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { env, getRequiredSecret } from '@/lib/env';
import type { Database } from '@/types/database';

export function createAdminSupabaseClient() {
  return createClient<Database>(env.supabaseUrl, getRequiredSecret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
