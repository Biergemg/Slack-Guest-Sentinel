/**
 * Supabase server-side client.
 *
 * Uses the Service Role key for unrestricted backend access — RLS policies
 * are bypassed by design. This client must NEVER be exposed to the browser.
 *
 * The env module validates both required variables at startup.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let _supabase: SupabaseClient<any, "public", any>;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient<any, "public", any>, {
  get: (_, prop: string | symbol) => {
    const client = getSupabase();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
