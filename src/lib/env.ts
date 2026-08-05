import 'server-only';

const requiredServerKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

function getRequired(key: (typeof requiredServerKeys)[number]): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  supabaseUrl: getRequired('NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: getRequired('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  appTimeZone: process.env.APP_TIME_ZONE ?? 'Asia/Kuala_Lumpur',
};

export function getRequiredSecret(key: 'SUPABASE_SERVICE_ROLE_KEY' | 'IC_HMAC_SECRET' | 'LOOKUP_TOKEN_SECRET' | 'STAFF_ACCESS_PASSWORD' | 'MASTER_ACTION_PASSWORD' | 'EMCEE_VIEW_TOKEN') {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required server secret: ${key}`);
  }

  return value;
}
