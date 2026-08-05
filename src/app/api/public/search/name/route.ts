import { NextResponse } from 'next/server';
import { z } from 'zod';

import { searchParticipantsByName } from '@/lib/data/public-participants';
import { normalizeName } from '@/lib/security/normalization';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({ query: z.string().trim().min(3).max(100) }).strict();

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit('public-name-search', 40))) {
      return NextResponse.json({ message: 'Terlalu banyak carian. Sila cuba lagi sebentar lagi.' }, { status: 429 });
    }

    const body = requestSchema.parse(await request.json());
    if (normalizeName(body.query).length < 3) {
      return NextResponse.json({ message: 'Taip sekurang-kurangnya 3 huruf untuk carian nama.' }, { status: 400 });
    }

    return NextResponse.json({ results: await searchParticipantsByName(body.query) });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Masukkan sekurang-kurangnya 3 huruf untuk carian nama.' : error instanceof Error ? error.message : 'Carian tidak dapat dilakukan.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
