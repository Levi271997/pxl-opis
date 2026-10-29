// Removes a connection (and its stored token). Owner/admin only.

import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { isConnectorId } from '@/lib/connectors/catalog';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const id = (await params).provider;
  if (!isConnectorId(id)) return NextResponse.json({ error: 'Unknown connector.' }, { status: 404 });
  const body = await request.json().catch(() => null);

  const access = await checkAccess(body?.workspaceId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.isAdmin) return NextResponse.json({ error: 'Only the owner or an admin can disconnect tools.' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Connectors aren\'t set up on the server.' }, { status: 503 });
  const { error } = await admin.from('integrations').delete().eq('workspace_id', access.workspaceId).eq('provider', id);
  if (error) return NextResponse.json({ error: 'Could not disconnect.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
