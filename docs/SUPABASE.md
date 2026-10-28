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

Then do the same with `supabase/migrations/20261029000000_arcade_scores.sql`. It adds
the arcade leaderboard; the games work without it, but scores aren't shared.

(If you later install the Supabase CLI, `supabase link` and `supabase db push`
apply the same file.)

## 4. Allowed redirect URLs

**Authentication → URL Configuration**

- **Site URL**: `http://localhost:3000` (change to your real domain when you deploy)
- **Redirect URLs**: add `http://localhost:3000/**` (and later `https://your-domain/**`)

## 5. Sign-in methods

### Email magic link

Already on by default (**Authentication → Sign In / Providers → Email**).
The built-in email sender only allows a few emails per hour, only delivers to
members of your Supabase organization, and doesn't let you edit the templates.
To fix that for free, send through a Gmail account:

1. On the Google account, turn on **2-Step Verification**, then create an app
   password at <https://myaccount.google.com/apppasswords> (name it "Supabase").
   Copy the 16-character password.
2. In Supabase, open **Authentication → Emails → SMTP Settings**, switch on
   **Enable custom SMTP**, and fill in:
   - Sender email: the Gmail address
   - Sender name: `Pxl Opis`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: the Gmail address
   - Password: the app password (without spaces)
3. Click **Save**.

Gmail allows about 500 emails a day, plenty for a small team. When you outgrow
it, Brevo's free plan (300 a day) works the same way: host
`smtp-relay.brevo.com`, port `587`, and the login and SMTP key from Brevo's
**SMTP & API** page. Keep these passwords in the Supabase dashboard only, never
in `.env.local` or git.

**Change the email template so links work in any browser.** By default the link
only works in the same browser you requested it from (otherwise you get
"PKCE code verifier not found"). To fix that:

1. Open **Authentication → Emails → Templates → Magic Link**.
2. Replace the link in the message body with:

   ```html
   <h2>Sign in to Pxl Opis</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Enter the office</a></p>
   ```

3. Click **Save**.

New users get the **Confirm signup** email instead the first time. Change that
template the same way, with `type=email` as well.

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

The first time you sign in, the app creates your workspace and fills it with the
demo team, projects and tasks (stored in your database, so you can change or
delete them in **Table Editor**). Task changes you make in the office are saved.

## What's next

- Live updates and real presence with Supabase Realtime.
- Connect Monday.com (OAuth). Its tokens go in the `integrations` table,
  read only by server code with the secret key.
