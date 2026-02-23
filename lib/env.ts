/**
 * Validated environment variables.
 *
 * Lazy getters: validation fires the first time each property is accessed
 * (i.e., inside a request handler), NOT at module load time. This keeps
 * `next build` working even when some env vars are absent from .env.local —
 * only routes that actually need a var will throw if it's missing.
 *
 * Usage: import { env } from '@/lib/env';
 *        env.SLACK_CLIENT_ID  // fully typed, never undefined
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `\n[env] Missing required environment variable: ${key}\n` +
      `  → Check your .env.local file.\n` +
      `  → See .env.example for all required variables.\n`
    );
  }
  return value.trim();
}

function requireEnvUrl(key: string): string {
  const value = requireEnv(key);
  try {
    new URL(value);
  } catch {
    throw new Error(
      `\n[env] Environment variable ${key} is not a valid URL.\n` +
      `  → Current value: "${value}"\n` +
      `  → Expected format: https://your-project.supabase.co\n`
    );
  }
  return value;
}

function requireEnvExactLength(key: string, bytes: number): string {
  const value = requireEnv(key);
  // Support both 32-character utf8 strings and 64-character hex strings
  const isHex = /^[0-9a-fA-F]+$/.test(value) && value.length === bytes * 2;
  const actualBytes = isHex ? Buffer.from(value, 'hex').length : Buffer.byteLength(value, 'utf8');

  if (actualBytes !== bytes) {
    throw new Error(
      `\n[env] Environment variable ${key} must be exactly ${bytes} bytes.\n` +
      `  → Current length: ${actualBytes} bytes.\n` +
      `  → Generate with: openssl rand -hex ${bytes} (hex) OR openssl rand -base64 ${bytes}\n`
    );
  }
  return value;
}

export const env = {
  // Supabase
  get SUPABASE_URL() { return requireEnvUrl('NEXT_PUBLIC_SUPABASE_URL'); },
  get SUPABASE_SERVICE_ROLE_KEY() { return requireEnv('SUPABASE_SERVICE_ROLE_KEY'); },

  // Slack OAuth
  get SLACK_CLIENT_ID() { return requireEnv('SLACK_CLIENT_ID'); },
  get SLACK_CLIENT_SECRET() { return requireEnv('SLACK_CLIENT_SECRET'); },
  get SLACK_SIGNING_SECRET() { return requireEnv('SLACK_SIGNING_SECRET'); },

  // Stripe
  get STRIPE_SECRET_KEY() { return requireEnv('STRIPE_SECRET_KEY'); },
  get STRIPE_WEBHOOK_SECRET() { return requireEnv('STRIPE_WEBHOOK_SECRET'); },
  get STRIPE_PRICE_STARTER() { return requireEnv('STRIPE_PRICE_STARTER'); },
  get STRIPE_PRICE_GROWTH() { return requireEnv('STRIPE_PRICE_GROWTH'); },
  get STRIPE_PRICE_SCALE() { return requireEnv('STRIPE_PRICE_SCALE'); },

  // App
  get APP_URL() { return requireEnvUrl('NEXT_PUBLIC_APP_URL'); },

  // Encryption — must be exactly 32 bytes for AES-256
  get ENCRYPTION_KEY() { return requireEnvExactLength('ENCRYPTION_KEY', 32); },

  // Internal cron authentication
  get CRON_SECRET() { return requireEnv('CRON_SECRET'); },

  // Derived helpers (safe to evaluate at module load — no validation needed)
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

export type Env = typeof env;
