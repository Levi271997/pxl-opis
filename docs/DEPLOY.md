# Going live

How Pxl Opis runs in production, and who sets which keys. Nothing here has been
deployed yet; this is the checklist for when it is.

## Who handles which keys

**Users never type in API keys.** There are two kinds of credentials:

### 1. The app's own keys (you set them once)

Everything in `.env.local` identifies **the app**, not a user:

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The Supabase project (safe in the browser) |
| `SUPABASE_SECRET_KEY` | Server-only Supabase key, used for connector tokens |
| `ANTHROPIC_API_KEY` | Claude, for the bots |
| `CONNECTORS_SECRET` | Encrypts connector tokens |
| `MONDAY_*`, `CLICKUP_*`, `GITHUB_*` client ID / secret | Your app registration with each tool |

Locally they live in `.env.local`. In production you paste them **once** into your
hosting provider's **Environment Variables** settings (Vercel, Netlify, Render, …).
That page replaces `.env.local`. Every team using the app shares these values
without ever seeing them.

- None of them except the two `NEXT_PUBLIC_SUPABASE_*` values may start with
  `NEXT_PUBLIC_`; that prefix sends a value to the browser.
- Use the **same** `CONNECTORS_SECRET` everywhere that shares the database. If it
  changes, stored tokens can't be decrypted and every tool must be reconnected.
- `.env.example` lists every variable.

### 2. Each team's access to its tools (through the UI)

A team's owner or admin opens **Settings → Connectors** and clicks **Connect**.
They sign in on Monday.com / ClickUp / GitHub's own site, and the app stores that
team's access token, encrypted, automatically. Your client ID and secret are what
make those sign-ins possible; teams never need them.

## Checklist

1. **Host the app** (Vercel is the simplest for Next.js) and set every variable
   above in its Environment Variables settings.
2. **Supabase → Authentication → URL Configuration:** set the **Site URL** to your
   real domain and add `https://your-domain/**` to the **Redirect URLs**.
3. **Run every migration** in `supabase/migrations/`, in order, on the production
   database (see `docs/SUPABASE.md`).
4. **Each connector app:** add the production redirect URL next to the localhost
   one:
   - Monday.com: `https://your-domain/api/connectors/monday/callback`
   - ClickUp: your domain (ClickUp matches on the domain)
   - GitHub: `https://your-domain/api/connectors/github/callback`
5. **Monday.com sharing:** for teams outside your own Monday account to connect,
   the Monday app may need to be shared or published in Monday's developer
   settings. Check this before launch. GitHub and ClickUp apps work for any account
   by default.
6. **Google / Microsoft sign-in:** add the production domain where those providers
   ask for it (see `docs/SUPABASE.md`).
7. **Email:** keep the custom SMTP and the token-hash email templates; the Site URL
   in step 2 makes the links point at the real domain.

## Open decisions

- **Who pays for Claude.** Every team's bot chats currently use **your**
  `ANTHROPIC_API_KEY`, so you pay for all of them (the daily cap per person,
  `BOT_DAILY_LIMIT`, limits the damage). Options: keep it and set a spend limit in
  the Anthropic Console; add a "Use your own Anthropic API key" field in Settings
  (stored encrypted like connector tokens); or tie bot usage to a paid plan.
- **Tools without OAuth.** Some services only offer pasted API tokens. Those would
  get a "Paste token" field on their connector card, stored the same encrypted way.
