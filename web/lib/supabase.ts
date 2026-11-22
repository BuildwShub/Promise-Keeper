import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { signUserJwt } from './jwt';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Server-only client with the secret/service_role key. Bypasses row-level security. Never import in client code. */
export function adminClient(): SupabaseClient {
  return createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client acting as one user: row-level security applies (auth.uid() = userId).
 * apikey is the publishable key when set; identity comes from the short-lived signed JWT.
 */
export function userClient(userId: string): SupabaseClient {
  const apikey = process.env.SUPABASE_PUBLISHABLE_KEY || need('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(need('SUPABASE_URL'), apikey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signUserJwt(userId)}` } },
  });
}
