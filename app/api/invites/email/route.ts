// Email invite: saves an invite for that address, then sends them a sign-in
// link through Supabase (your SMTP). When they sign in with that email, by any
// method, ensure_workspace() adds them to the team.

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const role = body?.role === 'admin' ? 'admin' : 'member';
  const workspaceId = String(body?.workspaceId ?? '');
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'That doesn\'t look like an email address.' }, { status: 400 });
  }

  // Saved as the signed-in user, so the database only allows it for owners/admins.
  const supabase = await createClient();
  const { error } = await supabase.from('invites').insert({ workspace_id: workspaceId, email, role });
  if (error) {
    return NextResponse.json({ error: 'Only the owner or an admin can invite people.' }, { status: 403 });
  }

  // A separate client with no session, so the admin's own sign-in isn't touched.
  const mailer = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: mailError } = await mailer.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=/` },
  });
  if (mailError) {
    return NextResponse.json({
      sent: false,
      warning: `Invite saved, but the email couldn't be sent (${mailError.message}). `
        + `They can still join by signing in at ${request.nextUrl.origin}/login with ${email}.`,
    });
  }
  return NextResponse.json({ sent: true });
}
