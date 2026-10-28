// Only allow redirects to paths on this site (blocks "//evil.com" style tricks).
export function safeNextPath(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

// Turn Supabase auth errors into something a person can act on.
export function friendlyAuthError(message: string) {
  if (/code verifier/i.test(message)) {
    return 'That sign-in link was opened in a different browser than the one you requested it from, '
      + 'or a newer link was sent since. Request a new link and open it in this browser.';
  }
  if (/expired|invalid/i.test(message)) {
    return 'That sign-in link has expired or was already used. Request a new one.';
  }
  return message;
}
