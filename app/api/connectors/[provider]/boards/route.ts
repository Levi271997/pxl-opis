// Picking which Monday.com boards sync into the office. Owner/admin only.
// GET lists the boards the connected account can see; POST saves the picks
// and syncs straight away.

import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { listBoards } from '@/lib/connectors/monday';
import { connection, syncMonday, type PickedBoard } from '@/lib/connectors/sync';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BOARDS = 10;

async function start(id: string, workspaceId: unknown) {
  if (id !== 'monday') return { error: NextResponse.json({ error: 'Board sync is only built for Monday.com so far.' }, { status: 404 }) };
  const access = await checkAccess(typeof workspaceId === 'string' ? workspaceId : null);
  if ('error' in access) return { error: NextResponse.json({ error: access.error }, { status: access.status }) };
  if (!access.isAdmin) return { error: NextResponse.json({ error: 'Only the owner or an admin can pick boards.' }, { status: 403 }) };
  const admin = createAdminClient();
  const conn = admin && await connection(admin, access.workspaceId);
  if (!admin || !conn) return { error: NextResponse.json({ error: 'Connect Monday.com first.' }, { status: 409 }) };
  return { admin, conn, workspaceId: access.workspaceId };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const s = await start((await params).provider, request.nextUrl.searchParams.get('workspace'));
  if ('error' in s) return s.error;
  try {
    const boards = await listBoards(s.conn.token);
    return NextResponse.json({ boards, picked: (s.conn.settings.boards ?? []).map(b => b.id), max: MAX_BOARDS });
  } catch (err) {
    console.error('Listing Monday.com boards failed:', err);
    return NextResponse.json({ error: 'Could not load your Monday.com boards. Try reconnecting.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const body = await request.json().catch(() => null);
  const s = await start((await params).provider, body?.workspaceId);
  if ('error' in s) return s.error;

  const picked: PickedBoard[] = (Array.isArray(body?.boards) ? body.boards : [])
    .filter((b: PickedBoard) => typeof b?.id === 'string' && /^\d+$/.test(b.id) && typeof b.name === 'string')
    .map((b: PickedBoard) => ({ id: b.id, name: b.name.slice(0, 200) }));
  if (picked.length > MAX_BOARDS) return NextResponse.json({ error: `Pick up to ${MAX_BOARDS} boards.` }, { status: 400 });

  const { error } = await s.admin.from('integrations')
    .update({ settings: { ...s.conn.settings, boards: picked } })
    .eq('workspace_id', s.workspaceId).eq('provider', 'monday');
  if (error) return NextResponse.json({ error: 'Could not save the boards. Has the Monday sync migration been run?' }, { status: 500 });

  try {
    return NextResponse.json({ ok: true, ...(await syncMonday(s.admin, s.workspaceId, s.conn.token, picked)) });
  } catch (err) {
    console.error('Monday.com sync failed:', err);
    return NextResponse.json({ error: 'The boards were saved, but syncing failed. Try Sync now.' }, { status: 502 });
  }
}
