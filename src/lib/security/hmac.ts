import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { getRequiredSecret } from '@/lib/env';

export function createIcHmac(ic: string): string {
  return createHmac('sha256', getRequiredSecret('IC_HMAC_SECRET')).update(ic).digest('hex');
}

export function createLookupSecretHmac(value: string): string {
  return createHmac('sha256', getRequiredSecret('LOOKUP_TOKEN_SECRET')).update(value).digest('hex');
}

export function hasValidSignature(value: string, signature: string): boolean {
  const expected = createLookupSecretHmac(value);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
