# Pxl Opis

A project-management app where you walk around a retro pixel office and talk to coworkers to see their tasks.

## Run it

```bash
npm install     # first time only
npm run dev     # then open http://localhost:3000
```

Production build: `npm run build && npm start`.

Without Supabase keys the app runs in **demo mode** (no sign-in, static data).
To turn on sign-in (Google, Microsoft, email link) and the database, follow
[docs/SUPABASE.md](docs/SUPABASE.md).

## How it's organised

| Path | What it is |
| --- | --- |
| `lib/data.ts` | Types and demo-mode data (coworkers, tasks, projects) |
| `lib/store.ts` | Zustand store: tasks + UI state, shared by React and the game |
| `lib/game/engine.ts` | Canvas game loop: movement, pathfinding, NPCs, drawing |
| `lib/game/map.ts` | Office layout (text grid) and tile art |
| `lib/game/sprites.ts` | Pixel characters drawn in code |
| `components/` | React UI: dialog box, board, desk panel, team list, HUD, start screen |

The game never renders through React. `GameCanvas` mounts the engine once,
the engine reads and writes the store, and React components re-render from the
store. React components move the player through `engineRef.current.walkToPerson(id)`.

When signed in, the office is loaded from Supabase and task changes are saved
there (`lib/supabase/office.ts`). In demo mode tasks live in memory, so a reload
resets them.
