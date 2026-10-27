# Pxl Opis: project context

A project-management web app with a game-like UI: you walk a pixel-art character
around a retro top-down office (Gather.town / old-Pokemon style) and go to coworkers
to see and manage their tasks. All data is static demo data for now. There is
no database or backend yet.

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

Stack: Next.js 15 (App Router), React 19, TypeScript (strict), Zustand 5.
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

## File map

| Path | What it is |
| --- | --- |
| `lib/data.ts` | Types and all static data: `PROJECTS`, `STATUSES`, `PRIORITY`, `PRESENCE`, `COWORKERS` (position, look, dialog lines, blocker), `INITIAL_TASKS` (`dueIn` = days from today), `ANNOUNCEMENTS`, `WATER_GOAL`, `FOODS` |
| `lib/store.ts` | Zustand store `useOffice`: player name/look, tasks, dialog/modal state, team panel, zone, water cups, fridge stock and lunch bag, plus actions. Also `getMode`, `getPerson`, `lookOf` |
| `lib/tasks.ts` | Task helpers: status cycling, sorting, due-date labels, `nextTaskId`, `firstName` |
| `lib/game/engine.ts` | Game loop, grid movement, BFS click-to-walk pathfinding, NPC idle/wander, interactions (`INTERACT` table keyed by tile char), drinking animation, open-fridge drawing, name tags and "E" prompts, camera, input |
| `lib/game/map.ts` | `MAP_ROWS` text grid (53×21), legend, `SOLID`, `FLOORS`, `ZONES`, and procedural 16×16 tile painters (`PAINTERS`), `paintOpenFridge`, `renderMap()` |
| `lib/game/sprites.ts` | Characters drawn in code (16×22, 4 directions × 3 walk frames), cached per look; `drawPortrait` for HUD/cards |
| `lib/game/food.ts` | 12×12 pixel art for fridge items (one char per pixel + palette) |
| `components/Office.tsx` | Composes the whole page |
| `components/DialogBox.tsx` | Pokemon-style typewriter dialog with optional choices. Movement keys close dialogs that have no choices |
| `components/ModalHost.tsx` | Renders the open modal: `board`, `status`, `fridge`, `person` |
| `components/Board.tsx` / `TaskCard.tsx` / `PersonPanel.tsx` | Kanban board (drag between columns, project filter), task card, a person's desk panel with add-task form |
| `components/StatusBoard.tsx` | Team status board: everyone's presence, current task, counts |
| `components/FridgePanel.tsx` / `FoodIcon.tsx` | Fridge contents, Take/Put back, lunch bag |
| `components/Hud.tsx`, `TeamPanel.tsx`, `StartScreen.tsx`, `ZoneBanner.tsx`, `Portrait.tsx` | HUD (name, room, water counter, buttons), team sidebar, avatar picker, room sign, sprite portrait |
| `app/globals.css` | All styles (retro pixel theme, fixed palette) |

## The office map

Edit the map in `lib/game/map.ts`. Each row is a string, and every row must be the
same width (currently 53). The rooms along the top row are Meeting Room (cols 1–12),
Kitchen (14–25), Dining Room (27–38; the Kitchen connects to it through a doorway
at col 26, rows 4–5) and Omar's Office (40–51). The open office is rows 9–19. Doors
in row 8 are at cols 6–7, 18–21, 32–33 and 45–46.

Legend: `#` wall, `.` wood, `,` carpet, `_` kitchen tile, `o` dining tile, `r` rug,
`d` desk, `p` plant, `b` bookshelf, `W` whiteboard (opens the project board),
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

Everything resets on reload: tasks, water, fridge stock.

## Testing approach used so far

Headless Chromium through `playwright-core`, installed in a scratch folder (not a
project dependency). Load the page, enter a name, then drive it with key taps
(each ~60 ms press = one tile at walk speed) or the Team panel's "Go" buttons, and
check DOM text (`#zone-name`, `#dialog-text`, `#modal-title`, `.water`) plus
screenshots. Plan routes around NPCs: Maya, Jordan, Priya and Sam stand in row 10,
Alex and Lena in row 14. Row 16 is clear.

## Ideas / possible next steps

- Backend + database (e.g. Supabase/Postgres): replace `INITIAL_TASKS` and the
  task actions in the store with API calls, plus auth.
- Real-time multiplayer (WebSockets / Colyseus) so real coworkers walk around.
- Move the world to Phaser 3 or PixiJS with a Tiled map and real sprite sheets
  once there are art assets.
- Save small per-user things (avatar, water count) in localStorage.
- Original plain HTML/JS prototype (pre-Next.js) lives outside this repo at
  `Desktop\pixel-office` on the first machine. It's no longer needed.
