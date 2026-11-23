#!/usr/bin/env node
// Encrypt / decrypt env files with a passphrase so the encrypted copy can be committed.
//
//   npm run env:lock              .env.local      -> .env.local.enc  (commit this)
//   npm run env:unlock            .env.local.enc  -> .env.local
//   npm run env:unlock -- --force  overwrite an existing .env.local
//   node scripts/env-crypt.mjs lock .env.production   (any file; output is <file>.enc)
//
// The passphrase is asked for (hidden) or read from the ENV_PASSPHRASE variable.
// Crypto: scrypt (N=2^17, r=8, p=1) key derivation + AES-256-GCM (tamper-proof).
// File format: "pxlenv1:" + base64(salt[16] | iv[12] | tag[16] | ciphertext).

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MAGIC = 'pxlenv1:';
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase.normalize('NFC'), salt, 32, SCRYPT);
}

function encrypt(plain, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const blob = Buffer.concat([salt, iv, cipher.getAuthTag(), ct]).toString('base64');
  return MAGIC + blob + '\n';
}

function decrypt(text, passphrase) {
  const trimmed = text.trim();
  if (!trimmed.startsWith(MAGIC)) throw new Error('Not an encrypted env file (missing header).');
  const raw = Buffer.from(trimmed.slice(MAGIC.length), 'base64');
  const salt = raw.subarray(0, 16);
  const iv = raw.subarray(16, 28);
  const tag = raw.subarray(28, 44);
  const ct = raw.subarray(44);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    throw new Error('Wrong passphrase (or the file was modified).');
  }
}

// Hidden prompt: raw-mode TTY input with backspace and Ctrl+C; falls back to a plain line.
function ask(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(question);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => (buf += d));
      stdin.on('end', () => resolve(buf.split(/\r?\n/)[0]));
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stderr.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stderr.write('\n');
          return reject(new Error('Cancelled.'));
        }
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function getPassphrase(confirm) {
  if (process.env.ENV_PASSPHRASE) return process.env.ENV_PASSPHRASE;
  const first = await ask('Passphrase: ');
  if (!first) throw new Error('Empty passphrase.');
  if (confirm) {
    if (first.length < 12) throw new Error('Use at least 12 characters.');
    const again = await ask('Repeat passphrase: ');
    if (again !== first) throw new Error('Passphrases do not match.');
  }
  return first;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const [cmd, fileArg] = args.filter((a) => !a.startsWith('--'));

  if (cmd === 'lock') {
    const src = fileArg ?? '.env.local';
    const out = src + '.enc';
    if (!existsSync(src)) throw new Error(`${src} not found.`);
    const pass = await getPassphrase(true);
    writeFileSync(out, encrypt(readFileSync(src), pass));
    console.error(`Encrypted ${src} -> ${out}. Commit ${out}; never commit ${src}.`);
  } else if (cmd === 'unlock') {
    const src = fileArg ?? '.env.local.enc';
    if (!src.endsWith('.enc')) throw new Error('Expected a .enc file.');
    const out = src.slice(0, -'.enc'.length);
    if (!existsSync(src)) throw new Error(`${src} not found.`);
    const pass = await getPassphrase(false);
    const plain = decrypt(readFileSync(src, 'utf8'), pass);
    if (existsSync(out) && !force) {
      if (readFileSync(out).equals(plain)) return console.error(`${out} is already up to date.`);
      throw new Error(`${out} exists and differs. Re-run with --force to overwrite it.`);
    }
    writeFileSync(out, plain);
    console.error(`Decrypted ${src} -> ${out}.`);
  } else {
    console.error('Usage: node scripts/env-crypt.mjs <lock|unlock> [file] [--force]');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
