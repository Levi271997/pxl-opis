// Step 2 of connecting: the provider sends you back here with a one-time code.
// We check it matches the sign-in you started, swap it for an access token,
// encrypt the token and save it (server only), then return you to the office.

import { NextResponse, type NextRequest } from 'next/server';
import { checkAccess } from '@/lib/connectors/access';
import { CONNECTORS, isConnectorId } from '@/lib/connectors/catalog';
import { encrypt } from '@/lib/connectors/crypto';
import { provider, redirectUri } from '@/lib/connectors/oauth';
import { backToOffice, decodeState, STATE_COOKIE } from '@/lib/connectors/state';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { origin, searchParams } = request.nextUrl;
  const id = (await params).provider;
  const done = (notice: string) => {
    const res = NextResponse.redirect(backToOffice(origin, notice));
    res.cookies.set(STATE_COOKIE, '', { path: '/api/connectors', maxAge: 0 });
    return res;
  };
  if (!isConnectorId(id)) return done('Unknown connector.');
  const name = CONNECTORS.find(c => c.id === id)!.name;

  if (searchParams.get('error')) return done(`${name} wasn't connected: ${searchParams.get('error_description') ?? 'access was denied'}.`);
  const pending = decodeState(request.cookies.get(STATE_COOKIE)?.value);
  const code = searchParams.get('code');
  if (!pending || pending.provider !== id || pending.state !== searchParams.get('state') || !code) {
    return done(`That ${name} sign-in expired or didn't match. Try connecting again.`);
  }

  // Check again: you must still be an owner/admin of the workspace you started from.
  const access = await checkAccess(pending.workspaceId);
  if ('error' in access) return done(access.error);
  if (!access.isAdmin) return done('Only the owner or an admin can connect tools.');

  const admin = createAdminClient();
  const p = provider(id);
  if (!admin || !p.configured) return done(`${name} isn't set up on the server yet.`);

  try {
    const token = await p.exchange(code, p.clientId!, p.secret!, redirectUri(origin, id));
    const account = await p.account(token.accessToken);
    const { error } = await admin.from('integrations').upsert({
      workspace_id: access.workspaceId,
      provider: id,
      access_token: encrypt(token.accessToken),
      refresh_token: token.refreshToken ? encrypt(token.refreshToken) : null,
      expires_at: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : null,
      scope: token.scope ?? null,
      account,
      connected_by: access.user.id,
    }, { onConflict: 'workspace_id,provider' });
    if (error) throw new Error(error.message);
    return done(`${name} is connected as ${account.name}.`);
  } catch (err) {
    console.error(`Connecting ${name} failed:`, err);
    return done(`${name} couldn't be connected. Try again, and check the app settings in docs/CONNECTORS.md.`);
  }
}
