'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = { kind: 'idle' | 'busy' | 'sent' | 'error'; message?: string };

export default function LoginCard({ configured, error }: { configured: boolean; error: string | null }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(error ? { kind: 'error', message: error } : { kind: 'idle' });
  const busy = status.kind === 'busy';
  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const withProvider = async (provider: 'google' | 'azure') => {
    setStatus({ kind: 'busy' });
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      // Microsoft (Azure) only returns the user's email when asked for it.
      options: { redirectTo: callbackUrl(), scopes: provider === 'azure' ? 'email' : undefined },
    });
    if (error) setStatus({ kind: 'error', message: error.message });
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: 'busy' });
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error
      ? { kind: 'error', message: error.message }
      : { kind: 'sent', message: `Check ${email.trim()} for your sign-in link.` });
  };

  return (
    <div id="start">
      <div className="start-card login-card">
        <h1>Pxl Opis</h1>
        <p className="sub">Sign in to enter the office.</p>

        {!configured ? (
          <p className="login-note">
            Sign-in isn&apos;t set up yet. Add your Supabase keys to <code>.env.local</code> (see
            <code> docs/SUPABASE.md</code>), then restart <code>npm run dev</code>.{' '}
            <a href="/">Continue in demo mode</a>
          </p>
        ) : (
          <>
            <div className="login-buttons">
              <button className="pixel-btn login-btn" disabled={busy} onClick={() => withProvider('google')}>
                <span className="login-logo google" aria-hidden>G</span> Continue with Google
              </button>
              <button className="pixel-btn login-btn" disabled={busy} onClick={() => withProvider('azure')}>
                <span className="login-logo microsoft" aria-hidden><i /><i /><i /><i /></span> Continue with Microsoft
              </button>
            </div>

            <div className="login-or"><span>or</span></div>

            <form className="login-email" onSubmit={sendMagicLink}>
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email" type="email" autoComplete="email" placeholder="you@company.com" required
                value={email} onChange={e => setEmail(e.target.value)}
              />
              <button className="pixel-btn big" type="submit" disabled={busy}>Email me a sign-in link</button>
            </form>
          </>
        )}

        {status.message && (
          <p className={`login-status ${status.kind}`} role="status">{status.message}</p>
        )}
      </div>
    </div>
  );
}
