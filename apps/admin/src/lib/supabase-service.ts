import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@publisheriq/database';

let serviceInstance: SupabaseClient<Database> | null = null;

/**
 * Returns a Supabase client using the service role key.
 *
 * Use this for Server Component database queries that need to bypass
 * the anon role's 3-second statement timeout.
 *
 * This client has elevated privileges - only use for read operations
 * in Server Components where the request is already behind auth middleware.
 */
export function getServiceSupabase(): SupabaseClient<Database> {
  if (serviceInstance) {
    return serviceInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  serviceInstance = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceInstance;
}
