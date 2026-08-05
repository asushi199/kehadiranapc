import { NextResponse } from 'next/server';
import { z } from 'zod';

import { confirmParticipantAttendance } from '@/lib/data/public-participants';
import { verifyLookupToken } from '@/lib/security/lookup-token';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({ lookupToken: z.string().min(20).max(1000) }).strict();

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit('public-attendance-confirmation', 10))) {
      return NextResponse.json({ message: 'Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.' }, { status: 429 });
    }

    const { lookupToken } = requestSchema.parse(await request.json());
    const token = verifyLookupToken(lookupToken, 'lookup');
    if (!token) {
      return NextResponse.json({ message: 'Sesi pengesahan telah tamat tempoh. Sila cari semula maklumat anda.' }, { status: 400 });
    }

    const result = await confirmParticipantAttendance(token.participantId, token.sessionId);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kehadiran tidak dapat disahkan. Sila cuba semula.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
