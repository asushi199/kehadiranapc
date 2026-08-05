import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getRequiredSecret } from '@/lib/env';

export const staffCookieName = 'apc_staff_access';
const maxAgeSeconds = 12 * 60 * 60;

function sign(value: string): string {
  return createHmac('sha256', getRequiredSecret('LOOKUP_TOKEN_SECRET')).update(`staff:${value}`).digest('hex');
}

export function createStaffAccessToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + maxAgeSeconds * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isValidStaffAccessToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length > 0) return false;
  const expected = Buffer.from(sign(payload), 'hex');
  const received = Buffer.from(signature, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function hasStaffAccess(): Promise<boolean> {
  return isValidStaffAccessToken((await cookies()).get(staffCookieName)?.value);
}

export async function requireStaffAccess(): Promise<void> {
  if (!(await hasStaffAccess())) redirect('/admin/login');
}

export function hasValidSharedPassword(password: string): boolean {
  const expected = Buffer.from(getRequiredSecret('STAFF_ACCESS_PASSWORD'));
  const received = Buffer.from(password);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function hasValidMasterPassword(password: string): boolean {
  const expected = Buffer.from(getRequiredSecret('MASTER_ACTION_PASSWORD'));
  const received = Buffer.from(password);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
