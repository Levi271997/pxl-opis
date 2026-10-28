// Supabase client for server components and route handlers.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Look } from '../data';
import type { Account } from './account';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';
import type { MemberRow, OfficeRows, ProjectRow, TaskRow } from './office';

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

// The signed-in user's office. ensure_workspace() accepts any email invites
// waiting for them, then returns their current workspace (creating an empty one
// the first time). Returns null (and the app falls back to the demo data) if
// anything fails.
export async function loadOffice(account: Account): Promise<OfficeRows | null> {
  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc('ensure_workspace');
  if (error || !workspaceId) {
    console.error('Could not load the workspace:', error?.message);
    return null;
  }

  const [members, projects, tasks] = await Promise.all([
    supabase.from('members').select('*').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('projects').select('*').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('code'),
  ]);
  const failed = members.error ?? projects.error ?? tasks.error;
  if (failed) {
    console.error('Could not load the office:', failed.message);
    return null;
  }

  return {
    workspaceId: workspaceId as string,
    userId: account.id,
    members: members.data as MemberRow[],
    projects: projects.data as ProjectRow[],
    tasks: tasks.data as TaskRow[],
  };
}
