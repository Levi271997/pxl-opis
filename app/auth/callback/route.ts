// Google and Microsoft sign-ins (and email links using the default template)
// land here with a one-time code, which we swap for a session cookie.

import { NextResponse, type NextRequest } from 'next/server';
import { friendlyAuthError, safeNextPath } from '@/lib/supabase/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  const reason = searchParams.get('error_description') ?? 'Sign-in was cancelled.';
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(friendlyAuthError(reason))}`);
}
