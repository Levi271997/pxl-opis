// How each connector signs in (OAuth 2.0 authorization code flow). Server only:
// it reads the client secrets from the environment. Each provider needs an app
// registered with it, with the redirect URL /api/connectors/<id>/callback
// (see docs/CONNECTORS.md).

import type { ConnectorId } from './catalog';

export interface Account { name: string; detail?: string }
interface Token { accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }

interface Provider {
  env: { id: string; secret: string };
  authorizeUrl(clientId: string, redirectUri: string, state: string): string;
  exchange(code: string, clientId: string, secret: string, redirectUri: string): Promise<Token>;
  account(accessToken: string): Promise<Account>;
}

async function json(res: Response, what: string) {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`${what} failed (${res.status})`);
  return body;
}

function query(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

const PROVIDERS: Record<ConnectorId, Provider> = {
  monday: {
    env: { id: 'MONDAY_CLIENT_ID', secret: 'MONDAY_CLIENT_SECRET' },
    authorizeUrl: (clientId, redirectUri, state) => query('https://auth.monday.com/oauth2/authorize', {
      client_id: clientId, redirect_uri: redirectUri, state,
      scope: 'me:read boards:read boards:write users:read workspaces:read',
    }),
    async exchange(code, clientId, secret, redirectUri) {
      const body = await json(await fetch('https://auth.monday.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: secret, code, redirect_uri: redirectUri }),
      }), 'Monday.com sign-in');
      if (!body.access_token) throw new Error('Monday.com sent no access token');
      return { accessToken: body.access_token, scope: body.scope };
    },
    async account(token) {
      const body = await json(await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ query: '{ me { name email account { name } } }' }),
      }), 'Reading the Monday.com account');
      const me = body?.data?.me;
      return { name: me?.account?.name ?? 'Monday.com', detail: me ? `${me.name} (${me.email})` : undefined };
    },
  },

  clickup: {
    env: { id: 'CLICKUP_CLIENT_ID', secret: 'CLICKUP_CLIENT_SECRET' },
    authorizeUrl: (clientId, redirectUri, state) => query('https://app.clickup.com/api', {
      client_id: clientId, redirect_uri: redirectUri, state,
    }),
    async exchange(code, clientId, secret) {
      const body = await json(await fetch(query('https://api.clickup.com/api/v2/oauth/token', {
        client_id: clientId, client_secret: secret, code,
      }), { method: 'POST' }), 'ClickUp sign-in');
      if (!body.access_token) throw new Error('ClickUp sent no access token');
      return { accessToken: body.access_token };
    },
    async account(token) {
      const body = await json(await fetch('https://api.clickup.com/api/v2/user', {
        headers: { Authorization: token },
      }), 'Reading the ClickUp account');
      const user = body?.user;
      return { name: user?.username ?? 'ClickUp', detail: user?.email };
    },
  },

  github: {
    env: { id: 'GITHUB_CLIENT_ID', secret: 'GITHUB_CLIENT_SECRET' },
    authorizeUrl: (clientId, redirectUri, state) => query('https://github.com/login/oauth/authorize', {
      client_id: clientId, redirect_uri: redirectUri, state, scope: 'repo read:user', allow_signup: 'false',
    }),
    async exchange(code, clientId, secret, redirectUri) {
      const body = await json(await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: secret, code, redirect_uri: redirectUri }),
      }), 'GitHub sign-in');
      if (!body.access_token) throw new Error(body.error_description ?? 'GitHub sent no access token');
      return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in, scope: body.scope };
    },
    async account(token) {
      const body = await json(await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'pxl-opis' },
      }), 'Reading the GitHub account');
      return { name: body.login, detail: body.name ?? undefined };
    },
  },
};

export function provider(id: ConnectorId) {
  const p = PROVIDERS[id];
  const clientId = process.env[p.env.id];
  const secret = process.env[p.env.secret];
  return { ...p, clientId, secret, configured: Boolean(clientId && secret) };
}

export const redirectUri = (origin: string, id: ConnectorId) => `${origin}/api/connectors/${id}/callback`;
