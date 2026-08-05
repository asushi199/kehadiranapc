import 'server-only';

import { hasValidSignature, createLookupSecretHmac } from '@/lib/security/hmac';

type LookupTokenKind = 'selection' | 'lookup';

interface LookupTokenPayload {
  exp: number;
  kind: LookupTokenKind;
  participantId: string;
  sessionId: string;
}

const TOKEN_TTL_MS = 15 * 60 * 1000;

function encodePayload(payload: LookupTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encodedPayload: string): LookupTokenPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as LookupTokenPayload;
    if (
      (payload.kind !== 'selection' && payload.kind !== 'lookup') ||
      typeof payload.participantId !== 'string' ||
      typeof payload.sessionId !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createLookupToken(kind: LookupTokenKind, participantId: string, sessionId: string): string {
  const encodedPayload = encodePayload({
    kind,
    participantId,
    sessionId,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  return `${encodedPayload}.${createLookupSecretHmac(encodedPayload)}`;
}

export function verifyLookupToken(token: string, expectedKind: LookupTokenKind): LookupTokenPayload | null {
  const [encodedPayload, signature, ...extra] = token.split('.');
  if (!encodedPayload || !signature || extra.length > 0 || !hasValidSignature(encodedPayload, signature)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.kind !== expectedKind || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}
