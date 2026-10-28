// Email sign-in links land here with a token hash (see the Magic Link email
// template in docs/SUPABASE.md). Unlike /auth/callback this needs nothing
// stored in the browser, so the link works in any browser or device.

import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { friendlyAuthError, safeNextPath } from '@/lib/supabase/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNextPath(searchParams.get('next'));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That sign-in link is incomplete. Request a new one.')}`);
}
