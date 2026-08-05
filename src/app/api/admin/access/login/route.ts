import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createStaffAccessToken, hasValidSharedPassword, staffCookieName } from '@/lib/auth/shared-access';

const requestSchema = z.object({ password: z.string().min(1).max(256) }).strict();

export async function POST(request: Request) {
  try {
    const { password } = requestSchema.parse(await request.json());
    if (!hasValidSharedPassword(password)) {
      return NextResponse.json({ message: 'Kata laluan tidak sah.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(staffCookieName, createStaffAccessToken(), {
      httpOnly: true,
      maxAge: 12 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'Permintaan tidak sah.' }, { status: 400 });
  }
}
