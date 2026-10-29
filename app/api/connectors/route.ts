// The Connectors settings list: which connectors exist, which are set up on the
// server, and which this workspace has connected. Never returns tokens.

import { NextResponse, type NextRequest } from 'next/server';
import { CONNECTORS } from '@/lib/connectors/catalog';
import { checkAccess } from '@/lib/connectors/access';
import { encryptionReady } from '@/lib/connectors/crypto';
import { provider } from '@/lib/connectors/oauth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const access = await checkAccess(request.nextUrl.searchParams.get('workspace'));
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const ready = admin !== null && encryptionReady();
  let rows: { provider: string; account: { name?: string; detail?: string } | null; connected_by: string | null; created_at: string }[] = [];
  let names = new Map<string, string>();

  if (admin) {
    const { data, error } = await admin
      .from('integrations')
      .select('provider, account, connected_by, created_at')
      .eq('workspace_id', access.workspaceId);
    if (error) return NextResponse.json({ error: 'Could not read connectors. Has the connectors migration been run?' }, { status: 500 });
    rows = data ?? [];
    const ids = rows.map(r => r.connected_by).filter((id): id is string => Boolean(id));
    if (ids.length) {
      const { data: people } = await admin
        .from('members')
        .select('user_id, display_name')
        .eq('workspace_id', access.workspaceId)
        .in('user_id', ids);
      names = new Map((people ?? []).map(p => [p.user_id as string, p.display_name as string]));
    }
  }

  return NextResponse.json({
    canManage: access.isAdmin,
    ready, // the server has its secret key and encryption key
    connectors: CONNECTORS.map(c => {
      const row = rows.find(r => r.provider === c.id);
      return {
        id: c.id,
        configured: provider(c.id).configured,
        connection: row && {
          account: row.account?.name ?? c.name,
          detail: row.account?.detail ?? null,
          connectedBy: (row.connected_by && names.get(row.connected_by)) || 'someone',
          connectedAt: row.created_at,
        },
      };
    }),
  });
}
