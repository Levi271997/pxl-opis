# Setting up Supabase for Pxl Opis

Until these steps are done the app runs in **demo mode**: no sign-in, static
demo data. Everything below happens in your browser; nothing here costs money on
the free plan.

## 1. Create the project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Pick a name (e.g. `pxl-opis`), a strong database password (save it somewhere
   safe), and the region closest to your team.
3. Wait a minute while it starts.

## 2. Add the keys to the app

1. In the project, open **Project Settings → API Keys** (older dashboards: **API**).
2. In the `pxl-opis` folder, copy `.env.example` to a new file named `.env.local`.
3. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`: the **Project URL** (`https://xxxx.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the **publishable** key (or the legacy **anon** key).
4. Restart the dev server (`Ctrl+C`, then `npm run dev`). The app now sends you
   to the sign-in page.

Never put the **secret / service_role** key in a `NEXT_PUBLIC_` variable or in git.

## 3. Create the database tables

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/20261028000000_init.sql` and click **Run**.

That creates the tables (profiles, workspaces, members, projects, tasks,
integrations), the security rules, and a `create_demo_workspace()` function that
fills a new team's office with the demo coworkers and tasks.

(If you later install the Supabase CLI, `supabase link` and `supabase db push`
apply the same file.)

## 4. Allowed redirect URLs

**Authentication → URL Configuration**

- **Site URL**: `http://localhost:3000` (change to your real domain when you deploy)
- **Redirect URLs**: add `http://localhost:3000/**` (and later `https://your-domain/**`)

## 5. Sign-in methods

### Email magic link

Already on by default (**Authentication → Sign In / Providers → Email**).
The built-in email sender only allows a few emails per hour. Fine for testing;
for real use, add your own SMTP under **Authentication → Emails → SMTP Settings**.

### Google

1. In Supabase, open **Authentication → Sign In / Providers → Google** and copy the
   **Callback URL** (looks like `https://xxxx.supabase.co/auth/v1/callback`).
2. Go to <https://console.cloud.google.com>, create or pick a project.
3. **APIs & Services → OAuth consent screen**: set it up (External, app name
   "Pxl Opis", your email).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: the Supabase callback URL from step 1
5. Copy the **Client ID** and **Client secret** into the Supabase Google provider
   and switch it on.

### Microsoft

1. In Supabase, open **Authentication → Sign In / Providers → Azure** and copy the
   **Callback URL**.
2. Go to <https://portal.azure.com> → **Microsoft Entra ID → App registrations →
   New registration**:
   - Name: Pxl Opis
   - Supported account types: **Accounts in any organizational directory and
     personal Microsoft accounts** (or just your organization, if it's internal)
   - Redirect URI: platform **Web**, value = the Supabase callback URL
3. On the app's **Overview**, copy the **Application (client) ID**.
4. **Certificates & secrets → New client secret**: copy the secret's **Value**
   (not the ID). It's only shown once.
5. Paste both into the Supabase Azure provider and switch it on. Leave the tenant
   URL empty for "any account", or set your tenant to restrict it to your company.

## 6. Try it

Open <http://localhost:3000>. You should land on the sign-in page. Sign in with
any method, pick your avatar, and enter the office. Your name and avatar are
saved to your profile and come back the next time you sign in.

## What's next

- Load the office (coworkers, projects, tasks) from the database instead of
  `lib/data.ts`, using `create_demo_workspace()` for a new team.
- Live updates and real presence with Supabase Realtime.
- Connect Monday.com (OAuth). Its tokens go in the `integrations` table,
  read only by server code with the secret key.
