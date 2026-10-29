// Connector tokens are encrypted (AES-256-GCM) before they go into the
// database, with the key in CONNECTORS_SECRET (32 random bytes, base64).
// Server only.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key() {
  const raw = process.env.CONNECTORS_SECRET;
  const buf = raw ? Buffer.from(raw, 'base64') : null;
  return buf?.length === 32 ? buf : null;
}

export const encryptionReady = () => key() !== null;

export function encrypt(plain: string) {
  const k = key();
  if (!k) throw new Error('CONNECTORS_SECRET is missing or not 32 bytes of base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map(p => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decrypt(sealed: string) {
  const k = key();
  if (!k) throw new Error('CONNECTORS_SECRET is missing or not 32 bytes of base64');
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised token format');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
