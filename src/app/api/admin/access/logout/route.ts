import { NextResponse } from 'next/server';

import { staffCookieName } from '@/lib/auth/shared-access';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(staffCookieName, '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' });
  return response;
}
