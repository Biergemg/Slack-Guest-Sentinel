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

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    // Server-side: never persist sessions between requests
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
