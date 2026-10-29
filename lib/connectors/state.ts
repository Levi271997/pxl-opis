// While someone is away signing in to a connector, a short-lived cookie
// remembers which connector and workspace they started from, plus a random
// state value the provider must send back (protects against forged callbacks).

import type { ConnectorId } from './catalog';

export const STATE_COOKIE = 'pxl_connect';

export interface PendingConnect { state: string; provider: ConnectorId; workspaceId: string }

export const encodeState = (p: PendingConnect) => Buffer.from(JSON.stringify(p)).toString('base64url');

export function decodeState(raw: string | undefined): PendingConnect | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return p?.state && p?.provider && p?.workspaceId ? p : null;
  } catch {
    return null;
  }
}

// Back to the office with a message (shown as a dialog when you arrive).
export const backToOffice = (origin: string, notice: string) => `${origin}/?notice=${encodeURIComponent(notice)}`;
