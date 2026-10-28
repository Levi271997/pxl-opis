// Invite links land here: /join/<token>. Signed in, you join the team straight
// away. Signed out, the token is kept in a cookie while you sign in, and the
// home page sends you back here afterwards.

import { NextResponse, type NextRequest } from 'next/server';
import { INVITE_COOKIE } from '@/lib/supabase/invite';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { origin } = request.nextUrl;
  if (!supabaseConfigured) return NextResponse.redirect(`${origin}/`);

  const home = (notice: string) => {
    const res = NextResponse.redirect(`${origin}/?notice=${encodeURIComponent(notice)}`);
    res.cookies.delete(INVITE_COOKIE);
    return res;
  };
  if (!UUID.test(token)) return home('That invite link is broken. Ask for a new one.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const res = NextResponse.redirect(`${origin}/login`);
    res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
    return res;
  }

  const { error } = await supabase.rpc('accept_invite', { invite_token: token });
  return home(error ? error.message : 'You joined the team! Your teammates are in the office.');
}
