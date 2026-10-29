// Supabase client with the secret key: bypasses row-level security, so it's
// for server code only (route handlers), and only after checking who is asking.
// Used for the integrations table, which browsers can't read.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
