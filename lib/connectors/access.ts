// Who may see or change a workspace's connectors. Checks run with the caller's
// own session (so the database decides), before any secret-key client is used.

import { createClient } from '../supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Access =
  | { error: string; status: number }
  | { user: { id: string }; workspaceId: string; isAdmin: boolean };

export async function checkAccess(workspaceId: string | null | undefined): Promise<Access> {
  if (!workspaceId || !UUID.test(workspaceId)) return { error: 'Unknown workspace.', status: 400 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in first.', status: 401 };
  const [member, admin] = await Promise.all([
    supabase.rpc('is_member', { ws: workspaceId }),
    supabase.rpc('is_admin', { ws: workspaceId }),
  ]);
  if (!member.data) return { error: 'You are not in that workspace.', status: 403 };
  return { user, workspaceId, isAdmin: admin.data === true };
}
