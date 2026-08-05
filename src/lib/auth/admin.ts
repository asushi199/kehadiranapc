import 'server-only';

import { redirect } from 'next/navigation';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export interface AdminIdentity {
  email: string;
  role: AppRole | null;
  userId: string;
}

export async function getCurrentAdminIdentity(): Promise<AdminIdentity | null> {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user || !user.email) return null;

  const adminClient = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error('Tidak dapat menyemak peranan pentadbir.');

  return {
    userId: user.id,
    email: user.email,
    role: profile?.is_active ? profile.role : null,
  };
}

export async function requireAdminIdentity(allowedRoles?: AppRole[]): Promise<AdminIdentity> {
  const identity = await getCurrentAdminIdentity();
  if (!identity) redirect('/admin/login');
  if (!identity.role || (allowedRoles && !allowedRoles.includes(identity.role))) {
    throw new Error('Akses anda tidak dibenarkan untuk tindakan ini.');
  }

  return identity;
}
