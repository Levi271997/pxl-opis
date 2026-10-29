// Sends a task change made in the office back to Monday.com. The office has
// already saved it; this only mirrors it. Any member may push their changes.

import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { connection, pushTask } from '@/lib/connectors/sync';
import { createAdminClient } from '@/lib/supabase/admin';

const FIELDS = ['title', 'status', 'priority', 'dueIn', 'project'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if ((await params).provider !== 'monday') return NextResponse.json({ error: 'Unknown connector.' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const access = await checkAccess(body?.workspaceId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (typeof body?.taskId !== 'string') return NextResponse.json({ error: 'Which task?' }, { status: 400 });
  const fields = (Array.isArray(body.fields) ? body.fields : []).filter((f: unknown) => FIELDS.includes(f as string));

  const admin = createAdminClient();
  const conn = admin && await connection(admin, access.workspaceId).catch(() => null);
  if (!admin || !conn) return NextResponse.json({ skipped: true });
  if (!conn.canWrite) {
    return NextResponse.json({ error: 'Monday.com was connected read-only. An admin needs to reconnect it in Settings → Connectors.' }, { status: 409 });
  }

  try {
    return NextResponse.json(await pushTask(admin, access.workspaceId, conn.token, body.taskId, fields));
  } catch (err) {
    console.error('Sending the change to Monday.com failed:', err);
    const message = err instanceof Error ? err.message : '';
    return NextResponse.json({ error: `Monday.com didn't accept the change${message ? ` (${message.replace(/^Monday\.com: /, '')})` : ''}.` }, { status: 502 });
  }
}
