/**
 * Supabase server-side client.
 *
 * Uses the Service Role key for unrestricted backend access — RLS policies
 * are bypassed by design. This client must NEVER be exposed to the browser.
 *
 * The env module validates both required variables at startup.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const initSupabase = () => {
  try {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        // Server-side: never persist sessions between requests
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    // In production, missing env vars must surface immediately — never silently
    // use a dummy client (matches the behavior of lib/stripe.ts).
    if (env.IS_PRODUCTION) {
      throw err;
    }
    // During `next build` static generation checks in dev/CI, return a dummy
    // client so the build doesn't crash.
    // Protected by `export const dynamic = 'force-dynamic'` in all routes.
    return createClient('https://placeholder.supabase.co', 'placeholder');
  }
};

export const supabase = initSupabase();
