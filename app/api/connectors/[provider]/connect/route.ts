// Step 1 of connecting: check you're an owner/admin, then send you to the
// provider's sign-in page. It sends you back to ../callback.

import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { CONNECTORS, isConnectorId } from '@/lib/connectors/catalog';
import { encryptionReady } from '@/lib/connectors/crypto';
import { provider, redirectUri } from '@/lib/connectors/oauth';
import { backToOffice, encodeState, STATE_COOKIE } from '@/lib/connectors/state';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { origin, searchParams } = request.nextUrl;
  const id = (await params).provider;
  if (!isConnectorId(id)) return NextResponse.redirect(backToOffice(origin, 'Unknown connector.'));
  const name = CONNECTORS.find(c => c.id === id)!.name;

  const access = await checkAccess(searchParams.get('workspace'));
  if ('error' in access) return NextResponse.redirect(backToOffice(origin, access.error));
  if (!access.isAdmin) return NextResponse.redirect(backToOffice(origin, 'Only the owner or an admin can connect tools.'));

  const p = provider(id);
  if (!p.configured || !createAdminClient() || !encryptionReady()) {
    return NextResponse.redirect(backToOffice(origin, `${name} isn't set up on the server yet. See docs/CONNECTORS.md.`));
  }

  const state = randomUUID();
  const res = NextResponse.redirect(p.authorizeUrl(p.clientId!, redirectUri(origin, id), state));
  res.cookies.set(STATE_COOKIE, encodeState({ state, provider: id, workspaceId: access.workspaceId }), {
    httpOnly: true, sameSite: 'lax', path: '/api/connectors', maxAge: 10 * 60, secure: origin.startsWith('https:'),
  });
  return res;
}
