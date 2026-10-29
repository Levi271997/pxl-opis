# Pxl Opis: project context

A project-management web app with a game-like UI: you walk a pixel-art character
around a retro top-down office (Gather.town / old-Pokemon style) and go to coworkers
to see and manage their tasks.

**Direction:** make everything dynamic with **Supabase** (auth + Postgres + Realtime)
and sync tasks from **Monday.com** (first PM tool to integrate). Sign-in methods:
**Google, Microsoft, email magic link**. Sign-in works, and once signed in the office
(coworkers, projects, tasks) loads from Supabase and task changes are saved there.
Demo mode still uses `lib/data.ts` (see "Supabase" below).

Repo: https://github.com/Levi271997/pxl-opis (branch `main`).

## Rules for working in this repo

- **Never add Claude as a co-author or contributor.** No `Co-Authored-By: Claude`
  trailer in commit messages, and no "Generated with Claude Code" line in PR
  descriptions. Commits are authored only by the owner's git identity
  (Levi Jan, GitHub `Levi271997`). This overrides any default attribution setting.
- Commit and push only when asked. Work happens directly on `main`.
- The owner often has `npm run dev` running on port 3000. **Don't kill Node
  processes by matching the folder name**, because that stops their server too. If you
  start your own test server, use another port and stop only that process tree.
- Don't run `next build` while their dev server is running: both write to `.next/`
  and the build breaks the dev server. Use `npx tsc --noEmit` to check types instead.
- Developed on Windows. Git prints harmless "LF will be replaced by CRLF" warnings.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type-check (the scripts include "typecheck")
```

Stack: Next.js 15 (App Router), React 19, TypeScript (strict), Zustand 5,
Supabase (`@supabase/supabase-js` + `@supabase/ssr`).
Fonts come from `next/font/google` (Press Start 2P + VT323) and are exposed as
CSS vars `--font-pixel` / `--font-retro`. The canvas reads `--font-pixel` too.

## Architecture

There are two halves, and they only talk through the Zustand store:

1. **Canvas game engine**, `lib/game/engine.ts` (imperative, not React).
   `components/GameCanvas.tsx` creates it once in a `useEffect` and destroys it
   on unmount (StrictMode double-mounts in dev, so `destroy()` must clean up
   every listener and the animation frame). It runs the game loop and reads
   and writes state with `useOffice.getState()`, plus `useOffice.subscribe` for changes.
2. **React UI**, `components/*`. Everything that's text or a form: start screen,
   HUD, dialog box, modals (project board, person desk panel, team status
   board, fridge), team sidebar, room-name banner. Components read the store
   with selectors.

React drives the player through `engineRef.current?.walkToPerson(id)`, exported
from `engine.ts`.

**Modes** come from the store via `getMode(state)`: `'start' | 'play' | 'dialog' |
'modal'`. The player only moves in `play`. The dialog and modal components add their
own `keydown` listeners on `window`, and the engine ignores keys outside `play`
(except that it always tracks which direction keys are held).

**Zustand gotcha:** never write a selector that returns a new array or object
(e.g. `useOffice(s => s.tasks.filter(...))`), because it loops forever with
`useSyncExternalStore`. Select `s.tasks`, then filter or `useMemo` in the component.

## Supabase

Setup steps for the owner are in `docs/SUPABASE.md`. Keys go in `.env.local`
(template: `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(publishable key). The secret key must never be `NEXT_PUBLIC_` or committed.

- **Demo mode:** if those env vars are missing, `supabaseConfigured` is false, the
  middleware lets everything through, `getAccount()` returns null, and the app
  behaves exactly as before (static data, no sign-in). Keep this working.
- **Auth flow:** `/login` (`components/LoginCard.tsx`) calls `signInWithOAuth`
  (`google`, `azure` with `scopes: 'email'`) or `signInWithOtp` (magic link), all
  redirecting to `/auth/callback` (`app/auth/callback/route.ts`), which exchanges the
  code for a session cookie. `middleware.ts` → `lib/supabase/middleware.ts` refreshes
  the session (`getClaims()`) and redirects signed-out users to `/login`.
- **Clients:** `lib/supabase/client.ts` (browser), `lib/supabase/server.ts`
  (server components/route handlers, plus `getAccount()`), `lib/supabase/account.ts`
  (the `Account` type passed from `app/page.tsx` → `Office` → `StartScreen`/`Hud`).
- **Profile:** the start screen only shows on a first visit (signed in: no `profiles.look`
  yet; demo mode: nothing in localStorage `pxl-opis:player`). Returning players are
  started straight away by `Office` after mount (`savedPlayer` in `lib/player.ts`), with
  no tips dialog; an invite notice then shows as a plain dialog. The HUD **Character**
  button opens the `character` modal (`CharacterSettings`, same `CharacterEditor` as the
  start screen) to change name/look; `savePlayer` writes `profiles` + your member row
  (or localStorage in demo mode). The HUD shows "Sign out" when signed in.
- **Schema:** `supabase/migrations/20261028000000_init.sql`: `profiles`, `workspaces`,
  `members` (everyone in the office, with desk position, look, greeting, blocker;
  `user_id` null for people without an account), `projects`, `tasks`
  (status `todo|doing|review|done`, priority `high|med|low`, `source` local/monday,
  `external_ref`), `integrations` (OAuth tokens; RLS on with **no** policies, so it's
  server-only). RLS everywhere else via `is_member(workspace_id)`. A trigger creates
  a profile on sign-up.
- **Teams** (migration `20261101000000_teams.sql`): `members.role` owner/admin/member,
  `is_admin(ws)`; members are readable by the team, managed by admins, and you can
  update your own row. Trigger `guard_members`: no moving members between
  workspaces/accounts, only admins change roles, the owner can't be demoted or removed
  (cascades and the SQL editor are let through). `invites` (token uuid; `email` null =
  reusable link, set = for that address only; 14-day expiry; admins only via RLS).
  RPCs: `accept_invite(token)` (used by `/join/[token]`), `ensure_workspace()` (accepts
  pending email invites for your JWT email, returns `profiles.current_workspace_id`,
  or creates an empty office: you as owner + "General" project). `create_demo_workspace()`
  was dropped and the demo team deleted. Tested end to end in PGlite (scratch script).
  The owner has run it on their Supabase project and signed in with a magic link.
- **Loading the office:** `app/page.tsx` calls `loadOffice()` (`lib/supabase/server.ts`):
  `ensure_workspace()`, then members/projects/tasks. `Office` converts the rows with `toOffice()`
  (`lib/supabase/office.ts`) and calls the store's `load()` **before** the canvas mounts,
  browser only (the store is a module singleton, so never fill it on the server).
  Ids become uuids: coworker id = member id, `project` = project id, your own member
  is still `'me'`, `Task.code` is the T-101 label. Every other member becomes an NPC:
  saved desk, else the next free `DESK_SLOTS` entry; no look yet = a `STARTER_LOOKS` one.
  `workspace.role` gates the team tools (`canManageTeam`).
- **Joining:** `/join/[token]` (public in the middleware) accepts the invite when signed
  in; when signed out it stores the token in the `pxl_invite` cookie and sends you to
  `/login`; `app/page.tsx` redirects back to `/join/...` once you're signed in. The result
  shows as a notice on the start screen (`?notice=`). Email invites:
  `POST /api/invites/email` inserts the invite with the caller's session (RLS = admins
  only), then `signInWithOtp` from a session-less client sends the email. `updateTask` / `addTask` update the store first, then `saveTask` /
  `insertTask`; on failure the change is rolled back. If loading fails, the server logs
  the error and the office falls back to the demo data.
- **Email links:** use the token_hash template (`/auth/confirm`); custom SMTP (free
  Gmail app password) is needed before Supabase lets you edit templates.

## File map

| Path | What it is |
| --- | --- |
| `lib/data.ts` | Types and the demo-mode data: `PROJECTS`, `STATUSES`, `PRIORITY`, `PRESENCE`, `COWORKERS` (position, look, dialog lines, blocker), `INITIAL_TASKS` (`dueIn` = days from today), `ANNOUNCEMENTS`, `WATER_GOAL`, `FOODS` |
| `lib/store.ts` | Zustand store `useOffice`: workspace, coworkers, projects, player name/look, tasks, dialog/modal state, team panel, zone, water cups, fridge stock and lunch bag, plus actions. Also `getMode`, `getPerson`, `lookOf`, `projectOf` |
| `lib/supabase/office.ts` | Database row types, `toOffice()` (rows to store data), `saveTask` / `insertTask` |
| `lib/tasks.ts` | Task helpers: status cycling, sorting, due-date labels, `nextTaskId`, `firstName` |
| `lib/game/engine.ts` | Game loop, grid movement, BFS click-to-walk pathfinding, NPC idle/wander, interactions (`INTERACT` table keyed by tile char), drinking animation, open-fridge drawing, name tags and "E" prompts, camera, input |
| `lib/game/map.ts` | `MAP_ROWS` text grid (37×17), legend, `SOLID`, `FLOORS`, `ZONES`, and procedural 16×16 tile painters (`PAINTERS`), `paintOpenFridge`, `renderMap()` |
| `lib/game/sprites.ts` | Characters drawn in code (16×22, 4 directions × 3 walk frames), cached per look; `drawPortrait` for HUD/cards |
| `lib/game/food.ts` | 12×12 pixel art for fridge items (one char per pixel + palette) |
| `components/Office.tsx` | Composes the whole page |
| `components/DialogBox.tsx` | Pokemon-style typewriter dialog with optional choices. Movement keys close dialogs that have no choices |
| `components/ModalHost.tsx` | Renders the open modal: `board`, `status`, `fridge`, `bookshelf`, `arcade`, `person` |
| `components/Board.tsx` / `TaskCard.tsx` / `PersonPanel.tsx` | Kanban board (drag between columns, project filter), task card, a person's desk panel with add-task form |
| `components/StatusBoard.tsx` | Team status board: everyone's presence, current task, counts |
| `components/FridgePanel.tsx` / `FoodIcon.tsx` | Fridge contents, Take/Put back, lunch bag |
| `components/ArcadePanel.tsx` | Arcade menu with best scores and team top 5, and the game screen (canvas 160×144 scaled up, keyboard input plus optional `click(x, y)` in game pixels, pause, game over, posts the score) |
| `lib/arcade/*` | The mini-games, original code: `snake.ts`, `breakout.ts`, `blocks.ts` (Block Drop), `race.ts` (Turbo Lane), `invaders.ts` (Inbox Invaders), `whack.ts` (Whack-a-Bug), `plane.ts` (Paper Plane), `pong.ts` (Break Room Pong), `crossing.ts` (Office Crossing). Each returns a `Game` with `update(dt, input)` / `draw(g)` / `score` / `over` (`types.ts`); listed in `index.ts` |
| `lib/supabase/arcade.ts` | `topScores` (best per person, top 5) and `postScore` for the `arcade_scores` table (migrations `20261029000000_arcade_scores.sql`, `20261030000000_arcade_race.sql` `20261102000000_arcade_invaders.sql`, `20261103000000_arcade_whack.sql` `20261104000000_arcade_plane_pong.sql` and `20261105000000_arcade_crossing.sql`, run separately; a new game id needs a migration that widens `arcade_scores_game_check`) |
| `components/TeamManager.tsx` | "Manage team" modal (Team panel > Manage): members with roles, change role / remove, invite links (create, copy, cancel), email invites |
| `app/join/[token]/route.ts`, `app/api/invites/email/route.ts`, `lib/supabase/invite.ts` | Invite link landing, email invite sender, the invite cookie name |
| `components/BotChat.tsx`, `app/api/bots/[id]/chat/route.ts`, `lib/bots.ts` | Claude bot chat: the panel (history from `bot_messages`, streams replies), the server route (auth, daily cap, Anthropic SDK streaming with `claude-opus-5-5`, saves both sides), shared limits and allowed models. Needs `ANTHROPIC_API_KEY` in `.env.local` (server only). Bots are `Coworker`s with `bot: true`, placed at `BOT_SLOTS`; `isBot(id)` swaps Tasks for Chat |
| `components/SettingsPanel.tsx`, `components/ConnectorsPanel.tsx` | HUD **Settings** modal (tabs: Character, Team, Connectors); the Connectors tab lists Monday.com / ClickUp / GitHub with Connect / Disconnect (owner/admin) and "Coming soon" tools |
| `lib/connectors/*`, `app/api/connectors/**`, `lib/supabase/admin.ts` | Connectors: `catalog.ts` (browser-safe list), `oauth.ts` (per-provider authorize URL, code exchange, account lookup; server only), `crypto.ts` (AES-256-GCM with `CONNECTORS_SECRET`), `state.ts` (sign-in state cookie), `access.ts` (member/admin check via `is_member`/`is_admin` RPCs with the caller's session). `monday.ts` (GraphQL client, column/label mapping, read board, update/create item), `sync.ts` (`syncMonday` boards → projects, items → tasks, people by email; `pushTask` office → Monday). Routes: list, `[provider]/connect`, `[provider]/callback`, `[provider]/disconnect`, `[provider]/boards` (GET list / POST pick + sync, admin), `[provider]/sync` (any member, skipped if synced < 2 min ago unless `force`), `[provider]/push` (mirror one task change). The store calls `pushTask` after saving a task in a project with `source: 'monday'`; `fetchBoard` reloads projects and tasks after a sync. Tokens live encrypted in `integrations` (no RLS policies) and are only touched with the secret-key client. Setup: `docs/CONNECTORS.md` |
| `components/BookshelfPanel.tsx` | Bookshelf list and paged reader (arrow keys turn pages; last page saved in localStorage) |
| `lib/books.ts` / `app/api/books/[id]/route.ts` | The 5 public-domain books, and the route that fetches one from Project Gutenberg (cached a month, license header/footer stripped, only listed ids) |
| `components/Hud.tsx`, `TeamPanel.tsx`, `StartScreen.tsx`, `ZoneBanner.tsx`, `Portrait.tsx` | HUD (name, room, water counter, buttons), team sidebar, first-visit start screen, room sign, sprite portrait |
| `components/CharacterEditor.tsx`, `CharacterSettings.tsx`, `lib/player.ts` | Name + avatar picker with spinning preview; the Character modal; remembering/saving the player |
| `app/globals.css` | All styles (retro pixel theme, fixed palette) |

## The office map

Edit the map in `lib/game/map.ts`. Each row is a string, and every row must be the
same width (currently 37; the map is 37×17). The rooms along the top row are Meeting
Room (cols 1–8), Kitchen (10–17), Dining Room (19–26; the Kitchen connects to it
through a doorway at col 18, rows 3–4) and Omar's Office (28–35), all rows 1–5. The
open office is rows 7–15. Doors in row 6 are at cols 4–5, 13–14, 22–23 and 33–34.
Player start is (17,13). If you move desks, update `DESK_SLOTS` (real teammates) and
`COWORKERS` (demo mode) in `lib/data.ts`. The engine moves any NPC whose saved spot is
solid or off the map to the nearest free tile (`freeTileNear`).

Legend: `#` wall, `.` wood, `,` carpet, `_` kitchen tile, `o` dining tile, `r` rug,
`d` desk, `p` plant, `b` bookshelf (opens the reader), `A` arcade machine (opens the arcade), `W` whiteboard (opens the project board),
`t` meeting table, `k` counter, `K` coffee machine, `f` fridge (opens the fridge),
`s` sofa, `N` notice board, `U` team status board, `C` water cooler (drink),
`g` dining table (eat), `h` chair.

**To add a new object:**
1. Pick an unused char and place it in `MAP_ROWS`.
2. Add it to `SOLID` if it blocks movement.
3. Add a painter in `PAINTERS`.
4. Add a handler in `INTERACT` (engine.ts), and an entry in `HIGHLIGHT` if it should show an "E ___" prompt.

If you move a coworker or a room, update their `x/y` (and `wander` box) in
`data.ts` and the `ZONES` list. Check that NPCs and furniture don't block doors.
A quick node one-liner that evals `MAP_ROWS` and checks row lengths is handy.

## Features so far (commit history on main)

1. Initial app: walkable office, 9 coworkers (2 wander), dialog with Show
   tasks / Any blockers? / Bye, desk panels, kanban board, team sidebar, start
   screen, click-to-walk.
2. Team status board (tile `U`), and movement keys now dismiss plain messages
   (before, the welcome tip blocked walking).
3. Dining Room plus water coolers in 3 places: drinking animation (cup and water
   drop) and a HUD counter toward 8 cups.
4. Openable fridges (Kitchen and Dining Room, shared stock): noodles, steak, fish,
   eggs, milk, Tom's lunchbox (locked). Take/Put back via a lunch bag, then eat
   at a dining table.

5. Supabase foundation: sign-in page (Google, Microsoft, magic link), auth callback,
   session middleware, saved profile (name + avatar), Sign out, database schema with
   RLS and a demo-workspace seeding function, setup guide. Demo mode still works.
6. Office loaded from Supabase; task changes saved.
7. Bookshelves (tile `b`) open a reader with 5 free classics from Project Gutenberg.
8. Status HUD button and U shortcut for the team status board.
9. Arcade (3 cabinets, tile `A`, below the player start): Snake, Breakout, Block Drop,
   personal bests in localStorage, team leaderboard in Supabase. Decided against a
   Game Boy emulator with commercial ROMs (Tetris/Mario are copyrighted).
10. Turbo Lane, a top-down racing game, added to the arcade.
11. Smaller office: map 53×21 → 37×17, all rooms and furniture kept, coworkers moved
    (migration `20261031000000_compact_office.sql` moves them in existing workspaces).
12. Real teams: owner/admin/member roles, invite links and email invites, Manage team
    panel; the demo team was removed (demo mode without Supabase still has it).
13. Inbox Invaders: shoot down waves of email (spam 20, urgent takes 2 hits), cardboard
    box cover, newsletter bonus, inbox-zero bonus per wave.
14. Start screen and tips only on the first visit; Character settings in the HUD.
15. Whack-a-Bug: 3×3 laptops, squash bugs (fast 20, critical 50), don't hit features,
    combo up to ×5, 60-second round or 10 shipped bugs.
16. Paper Plane (flap through gaps between filing cabinets, 1 point per gap) and Break
    Room Pong (vs Omar, 3 lives, Omar speeds up every 3 points, rallies add points).
17. Office Crossing: hop a coffee across 9 aisles (chairs, mail carts, robot vacuums,
    printer carts) to the team desk; safe rug in the middle; faster after each delivery.
18. Claude bots, milestone 1: Ada the starter bot, private streaming chats, daily cap
    (migration `20261106000000_bots.sql`). Esc now closes a modal even from a text box.
19. Settings button in the HUD (Character / Team / Connectors tabs) and connectors for
    Monday.com, ClickUp and GitHub: connect / disconnect
    (migration `20261107000000_connectors.sql`, setup in `docs/CONNECTORS.md`).
20. Two-way Monday.com board sync: admins pick boards (Choose boards), items become
    tasks, office edits go back to Monday.com, background sync on office load
    (migration `20261108000000_monday_sync.sql`, rules in `docs/CONNECTORS.md` section 4).

Everything else still resets on reload: tasks, water, fridge stock.

## Testing approach used so far

Headless Chromium through `playwright-core`, installed in a scratch folder (not a
project dependency). Load the page, enter a name, then drive it with key taps
(each ~60 ms press = one tile at walk speed) or the Team panel's "Go" buttons, and
check DOM text (`#zone-name`, `#dialog-text`, `#modal-title`, `.water`) plus
screenshots. Plan routes around NPCs: Maya, Jordan, Priya and Sam stand in row 8,
Alex and Lena in row 11. Rows 13–14 are clear; the arcade is 2 tiles below the start.

## Next steps (agreed plan)

1. Done: Supabase project, migration, magic-link sign-in. Still to do: turn on
   Google/Microsoft (see `docs/SUPABASE.md`).
2. Done: the office loads from Supabase and task changes are saved.
3. Realtime: subscribe to `tasks` changes; use Realtime **Presence** for real
   online status and to show other signed-in players walking around.
4. Done: Monday.com integration (OAuth connect, two-way board sync, people matched by
   email). Still to do: webhooks for instant updates, and creating office teammates
   for Monday.com people who haven't signed in.
5. Claude bots in the office: milestone 1 (chat) is built, see `docs/PLAN-claude-bots.md`
   for the build log and milestones 2 (board tools) and 3 (admin-managed bots).
6. Connectors: Settings → Connectors connects Monday.com, ClickUp and GitHub (OAuth,
   encrypted tokens). Monday.com boards sync both ways. Next: Monday.com webhooks for
   instant updates (needs a public URL), ClickUp and GitHub sync, and bot tools.
7. Going live: see `docs/DEPLOY.md`. App keys go in the host's environment variables
   (users never enter keys); add production redirect URLs; decide who pays for Claude.

## Other ideas

- Custom character art: sprite sheet PNGs (16×22 frames, rows down/up/left/right,
  3 columns) loaded into the same `Sprites` shape, optionally stored in Supabase Storage.
- Move the world to Phaser 3 or PixiJS with a Tiled map and real sprite sheets
  once there are art assets.
- Save small per-user things (avatar, water count) in localStorage.
- Original plain HTML/JS prototype (pre-Next.js) lives outside this repo at
  `Desktop\pixel-office` on the first machine. It's no longer needed.
