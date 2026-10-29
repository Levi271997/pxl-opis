// Pulls the picked Monday.com boards into the office again. Any member may
// ask (the office does on load); without `force`, a sync that ran in the last
// couple of minutes is skipped.

import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { connection, syncMonday } from '@/lib/connectors/sync';
import { createAdminClient } from '@/lib/supabase/admin';

const FRESH_MS = 2 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if ((await params).provider !== 'monday') return NextResponse.json({ error: 'Board sync is only built for Monday.com so far.' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const access = await checkAccess(body?.workspaceId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const conn = admin && await connection(admin, access.workspaceId).catch(() => null);
  if (!admin || !conn) return NextResponse.json({ synced: false, reason: 'not-connected' });
  const boards = conn.settings.boards ?? [];
  if (!boards.length) return NextResponse.json({ synced: false, reason: 'no-boards' });
  if (!body?.force && conn.syncedAt && Date.now() - new Date(conn.syncedAt).getTime() < FRESH_MS) {
    return NextResponse.json({ synced: false, reason: 'fresh' });
  }

  try {
    return NextResponse.json({ synced: true, ...(await syncMonday(admin, access.workspaceId, conn.token, boards)) });
  } catch (err) {
    console.error('Monday.com sync failed:', err);
    return NextResponse.json({ error: 'Syncing with Monday.com failed. Try reconnecting it in Settings.' }, { status: 502 });
  }
}
