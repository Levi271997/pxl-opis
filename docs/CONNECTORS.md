# Setting up connectors

**Settings → Connectors** (the HUD's Settings button, or Manage team → Connectors)
lets the owner or an admin connect Monday.com, ClickUp and GitHub to the office.
Everyone on the team can see what's connected.

What connecting does today: it signs in to the tool and stores an access token
for your office. **Syncing tasks onto the board and letting bots use the tools are
the next step**; this part gets the connections in place.

Everything below goes in `.env.local` (git-ignored). None of these values may
start with `NEXT_PUBLIC_`. Restart `npm run dev` after changing it.

## 1. Server keys (once)

1. **Run the migration** `supabase/migrations/20261107000000_connectors.sql` in the
   Supabase SQL editor.
2. **`SUPABASE_SECRET_KEY`**: Supabase dashboard → Project Settings → API Keys →
   the **secret** key (`sb_secret_...`, or the legacy `service_role` key). The
   server uses it to store tokens in a table browsers can't read.
3. **`CONNECTORS_SECRET`**: tokens are encrypted with this before they're saved.
   Generate one:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Keep it safe: if it's lost or changed, every tool has to be connected again.

## 2. One app per tool

Each tool needs an "app" registered with it, which gives you a **client ID** and a
**client secret**. Every app asks for a **redirect URL**:

```
http://localhost:3000/api/connectors/<tool>/callback
```

with `<tool>` being `monday`, `clickup` or `github`. When you deploy, add the same
path on your real domain (for example `https://pxl-opis.example.com/api/connectors/github/callback`).

Menus move around; if a step doesn't match, check the tool's developer docs for
"OAuth app".

### Monday.com

1. In Monday.com, open the **Developer Center** (profile picture → Developers) and
   create an app.
2. Under **OAuth**, add the redirect URL above (`.../monday/callback`) and the
   scopes `me:read`, `boards:read`, `users:read`, `workspaces:read`.
3. Copy the **Client ID** and **Client secret** into `MONDAY_CLIENT_ID` and
   `MONDAY_CLIENT_SECRET`.

### ClickUp

1. In ClickUp, open **Settings → Apps → API** and create an app.
2. Set the redirect URL to `localhost:3000` (ClickUp matches on the domain), and
   your real domain later.
3. Copy the **Client ID** and **Client secret** into `CLICKUP_CLIENT_ID` and
   `CLICKUP_CLIENT_SECRET`.

### GitHub

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL `http://localhost:3000`, **Authorization callback URL**
   `http://localhost:3000/api/connectors/github/callback`.
3. Create it, then **Generate a new client secret**. Copy both into
   `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

The app asks for `repo` (read and write issues and pull requests) and
`read:user` access.

## 3. Connect

Restart the dev server, open **Settings → Connectors**, and click **Connect** next
to a tool. You sign in on the tool's own site and come back to the office with a
message saying it's connected.

**Disconnect** deletes the stored token. To fully revoke access, also remove the
app's authorization in the tool's own settings (GitHub: Settings → Applications →
Authorized OAuth Apps).

## How it's kept safe

- Only the owner and admins can connect or disconnect; both are checked on the
  server, with your own session, before anything else happens.
- Sign-in uses a random `state` value kept in a short-lived httpOnly cookie, so a
  forged callback is rejected.
- Tokens are encrypted (AES-256-GCM) with `CONNECTORS_SECRET` and stored in the
  `integrations` table, which has no browser access at all. The settings page
  only ever sees the account name, who connected it, and when.
