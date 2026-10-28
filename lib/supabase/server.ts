// Supabase client for server components and route handlers.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Look } from '../data';
import type { Account } from './account';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: cookiesToSet => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getAccount(): Promise<Account | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // The profile row may not exist yet if the database migration hasn't been run.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, look')
    .eq('id', user.id)
    .maybeSingle();

  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  return {
    id: user.id,
    email,
    name: profile?.display_name || meta.full_name || meta.name || email.split('@')[0],
    look: (profile?.look as Look | null) ?? null,
  };
}
