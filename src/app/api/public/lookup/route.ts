import { NextResponse } from 'next/server';
import { z } from 'zod';

import { lookupParticipantByIc, lookupParticipantBySelection } from '@/lib/data/public-participants';
import { isCompleteIc, normalizeIc } from '@/lib/security/normalization';
import { verifyLookupToken } from '@/lib/security/lookup-token';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.union([
  z.object({ selectionToken: z.string().min(20).max(1000) }).strict(),
  z.object({ ic: z.string().min(1).max(32) }).strict(),
]);

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit('public-lookup', 20))) {
      return NextResponse.json({ message: 'Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.' }, { status: 429 });
    }

    const body = requestSchema.parse(await request.json());
    const result =
      'selectionToken' in body
        ? await lookupFromSelectionToken(body.selectionToken)
        : await lookupFromIc(body.ic);

    if (!result) {
      return NextResponse.json({ message: 'Rekod tidak ditemui.' }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Carian tidak dapat dilakukan. Sila cuba semula.';
    return NextResponse.json({ message }, { status: 400 });
  }
}

async function lookupFromSelectionToken(selectionToken: string) {
  const token = verifyLookupToken(selectionToken, 'selection');
  if (!token) throw new Error('Pilihan carian telah tamat tempoh. Sila cari semula nama anda.');
  return lookupParticipantBySelection(token.participantId, token.sessionId);
}

async function lookupFromIc(ic: string) {
  if (!isCompleteIc(ic)) {
    throw new Error('Masukkan nombor Kad Pengenalan lengkap 12 digit.');
  }

  return lookupParticipantByIc(normalizeIc(ic));
}
