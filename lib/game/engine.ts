// The canvas world: Pokemon-style grid movement, click-to-walk pathfinding,
// coworkers, interactions and rendering. It talks to React only through the
// zustand store (reads state, calls actions like openDialog / openModal).

import { ANNOUNCEMENTS, FOODS, PLAYER_START, PRESENCE, WATER_GOAL, type Dir, type Presence } from '../data';
import { getMode, getPerson, useOffice } from '../store';
import { firstName } from '../tasks';
import { MAP_H, MAP_W, TILE, isSolid, paintOpenFridge, rect, renderMap, tileAt, zoneAt } from './map';
import { spritesFor, type Sprites } from './sprites';

const WALK_SPEED = 5; // tiles per second
const RUN_SPEED = 9;
const NPC_SPEED = 3;
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIR_NAMES = Object.keys(DIRS) as Dir[];
const KEY_DIRS: Record<string, Dir> = {
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
};
// Objects that get an "E" prompt when you face them.
const HIGHLIGHT: Record<string, string> = { W: 'Board', N: 'Read', K: 'Coffee', U: 'Team', C: 'Drink', f: 'Open', b: 'Books' };
const DRINK_TIME = 1.6; // seconds the drinking animation lasts
// Pixel water drop shown above your head while drinking (k outline, b blue, w shine).
const DROP = ['...k...', '..kbk..', '.kbbbk.', 'kbwbbbk', 'kbwbbbk', 'kbbbbbk', '.kbbbk.', '..kkk..'];
const DROP_COLORS: Record<string, string> = { k: '#1c1726', b: '#4fb3ff', w: '#e6f6ff' };

interface Entity {
  x: number; y: number; px: number; py: number;
  dir: Dir; moving: boolean; toX: number; toY: number; t: number; step: number;
  sprites: Sprites;
}
interface Npc extends Entity {
  id: string; homeDir: Dir; wander: { x1: number; y1: number; x2: number; y2: number } | null;
  timer: number; talking: boolean;
}
type Goal = { npcId: string; tries: number } | { x: number; y: number };
interface Player extends Entity {
  path: { x: number; y: number }[];
  goal: Goal | null;
  dest: { x: number; y: number; tries: number } | null;
}

export interface Engine {
  walkToPerson(id: string): void;
  destroy(): void;
}

export const HELP_PAGES = [
  'ARROWS or WASD to walk. Hold SHIFT to run.',
  'Face a coworker and press E or SPACE to talk. You can also click anywhere to walk there.',
  'B opens the project board, U the team status board, T the team list. ESC closes windows.',
];

// Lets React components (board "Go" buttons, team list) drive the player.
export const engineRef: { current: Engine | null } = { current: null };

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeEntity(x: number, y: number, dir: Dir, sprites: Sprites): Entity {
  return { x, y, px: x * TILE, py: y * TILE, dir, moving: false, toX: x, toY: y, t: 0, step: 0, sprites };
}

function dirBetween(a: { x: number; y: number }, b: { x: number; y: number }): Dir {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
const isAdjacent = (a: Entity, b: Entity) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

// Step pose for the first half of each tile, standing pose for the second.
function frameOf(e: Entity) {
  if (!e.moving || e.t >= 0.5) return 0;
  return e.step % 2 ? 1 : 2;
}

function advance(e: Entity, dt: number, speed: number) {
  if (!e.moving) return false;
  e.t += dt * speed;
  let arrived = false;
  if (e.t >= 1) {
    e.x = e.toX; e.y = e.toY;
    e.moving = false; e.t = 0; e.step++;
    arrived = true;
  }
  e.px = (e.x + (e.toX - e.x) * e.t) * TILE;
  e.py = (e.y + (e.toY - e.y) * e.t) * TILE;
  return arrived;
}

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const ctx = canvas.getContext('2d')!;
  const ui = () => useOffice.getState();
  const mode = () => getMode(ui());
  const mapImage = renderMap();
  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim() || '"Press Start 2P", monospace';

  let S = 3, dpr = 1, time = 0, last = performance.now(), raf = 0;
  let dirs: Dir[] = [];
  let running = false;
  let zone: string | null = null;
  let marker: { x: number; y: number; t: number; ok: boolean } | null = null;
  let drinkTimer = 0; // > 0 while the player is drinking
  let openFridge: { x: number; y: number } | null = null; // fridge whose door is open
  const cam = { x: 0, y: 0, ox: 0, oy: 0 };

  const player: Player = {
    ...makeEntity(PLAYER_START.x, PLAYER_START.y, 'up', spritesFor(ui().player.look)),
    path: [], goal: null, dest: null,
  };
  // Coworkers are loaded into the store before the canvas mounts (see Office).
  const npcs: Npc[] = ui().coworkers.map(c => ({
    ...makeEntity(c.x, c.y, c.dir, spritesFor(c.look)),
    id: c.id, homeDir: c.dir, wander: c.wander ?? null, timer: Math.random() * 3, talking: false,
  }));
  const npcById = (id: string) => npcs.find(n => n.id === id);

  const say = (pages: string[], speaker?: string) => ui().openDialog({ pages, speaker });
  // Each handler gets the tile it was used on.
  const INTERACT: Record<string, (x: number, y: number) => void> = {
    W: () => ui().openModal({ kind: 'board' }),
    U: () => ui().openModal({ kind: 'status' }),
    C: () => startDrinking(),
    g: () => eatAtTable(),
    h: () => say(['A dining chair. Lunch break is the best meeting of the day.']),
    N: () => say(ANNOUNCEMENTS, 'NOTICE BOARD'),
    K: () => say(['*brrrzzzt*', 'You brew a fresh cup of coffee. Focus +10!'], 'COFFEE'),
    b: () => ui().openModal({ kind: 'bookshelf' }),
    f: (x, y) => { openFridge = { x, y }; ui().openModal({ kind: 'fridge' }); },
    t: () => say(['Next meeting here: Sprint 14 Review, Thursday 2:00 PM.'], 'MEETING TABLE'),
    s: () => say(['You sit for a moment. Ahh. Back to work!']),
    p: () => say(['A very healthy office plant. Someone is watering it.']),
    d: () => say(['A hot desk. Free to use today.']),
  };

  // ---------- movement ----------

  // An entity reserves both the tile it is on and the one it is walking into.
  function occupied(x: number, y: number, self: Entity): Entity | null {
    for (const e of [player, ...npcs]) {
      if (e === self) continue;
      if ((e.x === x && e.y === y) || (e.moving && e.toX === x && e.toY === y)) return e;
    }
    return null;
  }
  const npcAt = (x: number, y: number) => occupied(x, y, player) as Npc | null;

  function tryStep(e: Entity, dir: Dir) {
    e.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = e.x + dx, ny = e.y + dy;
    if (isSolid(nx, ny) || occupied(nx, ny, e)) return false;
    Object.assign(e, { moving: true, toX: nx, toY: ny, t: 0 });
    return true;
  }

  // ---------- pathfinding (BFS on the tile grid) ----------

  function openNeighbors(x: number, y: number) {
    return Object.values(DIRS)
      .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
      .filter(([nx, ny]) => !isSolid(nx, ny) && (!npcAt(nx, ny) || (nx === player.x && ny === player.y)));
  }

  function findPath(sx: number, sy: number, goals: [number, number][]) {
    const key = (x: number, y: number) => y * MAP_W + x;
    const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
    if (!goalSet.size) return null;
    const start = key(sx, sy);
    const prev = new Map<number, number>([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const k = queue.shift()!;
      if (goalSet.has(k)) {
        const path: { x: number; y: number }[] = [];
        for (let c = k; c !== start; c = prev.get(c)!) path.unshift({ x: c % MAP_W, y: Math.floor(c / MAP_W) });
        return path;
      }
      const x = k % MAP_W, y = Math.floor(k / MAP_W);
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (prev.has(nk) || isSolid(nx, ny) || npcAt(nx, ny)) continue;
        prev.set(nk, k);
        queue.push(nk);
      }
    }
    return null;
  }

  function walkTo(tx: number, ty: number, tries = 0) {
    const npc = npcAt(tx, ty);
    let goals: [number, number][], goal: Goal | null = null;
    if (npc) {
      tx = npc.x; ty = npc.y;
      goals = openNeighbors(tx, ty);
      goal = { npcId: npc.id, tries };
    } else if (isSolid(tx, ty)) {
      goals = openNeighbors(tx, ty);
      if (INTERACT[tileAt(tx, ty)]) goal = { x: tx, y: ty };
    } else {
      goals = [[tx, ty]];
    }
    const sx = player.moving ? player.toX : player.x, sy = player.moving ? player.toY : player.y;
    const path = findPath(sx, sy, goals);
    marker = { x: tx, y: ty, t: 0, ok: !!path };
    if (!path) return false;
    player.path = path;
    player.goal = goal;
    player.dest = { x: tx, y: ty, tries };
    return true;
  }

  function walkToPerson(id: string, tries = 0) {
    const n = npcById(id);
    if (n) walkTo(n.x, n.y, tries);
  }

  function cancelPath() {
    player.path = []; player.goal = null; player.dest = null;
  }

  // ---------- player ----------

  function planStep() {
    if (mode() !== 'play') return;
    const dir = dirs[dirs.length - 1];
    if (dir) { cancelPath(); tryStep(player, dir); return; }
    if (player.path.length) {
      if (tryStep(player, dirBetween(player, player.path[0]))) player.path.shift();
      else if (player.dest && player.dest.tries < 4) { // someone stepped into the way: route around
        const { x, y, tries } = player.dest, goal = player.goal;
        if (walkTo(x, y, tries + 1) && goal) player.goal = 'npcId' in goal ? { ...goal, tries: tries + 1 } : goal;
      } else cancelPath();
      return;
    }
    if (player.goal) finishGoal();
  }

  function finishGoal() {
    const g = player.goal!;
    player.goal = null;
    if ('npcId' in g) {
      const n = npcById(g.npcId)!;
      if (isAdjacent(player, n)) { player.dir = dirBetween(player, n); talkTo(n); }
      else if (g.tries < 3) walkToPerson(n.id, g.tries + 1); // they wandered off
    } else {
      player.dir = dirBetween(player, g);
      INTERACT[tileAt(g.x, g.y)]?.(g.x, g.y);
    }
  }

  function checkZone() {
    const z = zoneAt(player.x, player.y);
    if (z && z !== zone) { zone = z; ui().setZone(z); }
  }

  // ---------- food ----------

  function eatAtTable() {
    const { bag } = ui();
    const packed = FOODS.filter(f => bag[f.id] > 0);
    if (!packed.length) {
      say([
        'Lunch is served 12:00 to 1:00. Today: pasta and a big salad.',
        'Tip: grab something from a fridge, then come back here to eat it.',
      ], 'DINING TABLE');
      return;
    }
    ui().openDialog({
      pages: ['Lunch time! What do you want to eat?'],
      speaker: 'DINING TABLE',
      choices: [...packed.map(f => f.name), 'Not now'],
      onChoice: choice => {
        const food = packed.find(f => f.name === choice);
        if (!food) return;
        ui().eatFood(food.id);
        say([food.eatLine], 'YUM');
      },
    });
  }

  // ---------- drinking water ----------

  function startDrinking() {
    if (drinkTimer > 0) return;
    cancelPath();
    dirs = [];
    player.dir = 'down'; // turn around to face the room while sipping
    drinkTimer = DRINK_TIME;
  }

  function finishDrinking() {
    const cups = ui().drinkWater();
    if (mode() !== 'play') return;
    const line = cups === 1 ? 'Ahh, cold water. Your first cup today!'
      : cups < WATER_GOAL ? `Refreshing! That's ${cups} of ${WATER_GOAL} cups today.`
      : cups === WATER_GOAL ? `${WATER_GOAL} cups! You're fully hydrated. The plants are jealous.`
      : `${cups} cups... maybe take a bathroom break soon.`;
    say([line], 'WATER');
  }

  function updatePlayer(dt: number) {
    if (drinkTimer > 0) {
      drinkTimer -= dt;
      if (drinkTimer <= 0) finishDrinking();
      return;
    }
    if (!player.moving) planStep();
    if (advance(player, dt, running ? RUN_SPEED : WALK_SPEED)) {
      checkZone();
      planStep(); // keep walking without a one-frame pause
    }
  }

  // ---------- interaction ----------

  function findFocus(): { npc: Npc; turn?: Dir } | { tile: string; x: number; y: number } | null {
    if (player.moving) return null;
    const [dx, dy] = DIRS[player.dir];
    const fx = player.x + dx, fy = player.y + dy;
    const n = npcAt(fx, fy);
    if (n) return { npc: n };
    const t = tileAt(fx, fy);
    if (INTERACT[t]) return { tile: t, x: fx, y: fy };
    // Be forgiving: anyone right next to you counts, even if you aren't facing them.
    for (const dir of DIR_NAMES) {
      const [ax, ay] = DIRS[dir];
      const other = npcAt(player.x + ax, player.y + ay);
      if (other) return { npc: other, turn: dir };
    }
    return null;
  }

  function interact() {
    const f = findFocus();
    if (!f) return;
    if ('npc' in f) {
      if (f.turn) player.dir = f.turn;
      talkTo(f.npc);
    } else INTERACT[f.tile](f.x, f.y);
  }

  function talkTo(npc: Npc) {
    const person = ui().coworkers.find(c => c.id === npc.id)!;
    const speaker = firstName(person.name).toUpperCase();
    cancelPath();
    npc.talking = true;
    npc.dir = dirBetween(npc, player);
    const tasks = ui().tasks.filter(t => t.assignee === npc.id);
    const open = tasks.filter(t => t.status !== 'done').length;
    const doing = tasks.filter(t => t.status === 'doing').length;
    const pages = [...person.greeting];
    if (person.status === 'busy') pages.unshift("(They're in focus mode, but take off one headphone.)");
    pages.push(open
      ? `I have ${open} open task${open === 1 ? '' : 's'} right now, ${doing} in progress.`
      : 'All my tasks are done. Coffee time!');
    const release = () => { npc.talking = false; npc.timer = 2; };
    ui().openDialog({
      pages,
      speaker,
      choices: ['Show tasks', 'Any blockers?', 'Bye'],
      onClose: release,
      onChoice: choice => {
        if (choice === 'Show tasks') ui().openModal({ kind: 'person', id: npc.id });
        if (choice === 'Any blockers?') {
          npc.talking = true;
          ui().openDialog({ pages: [person.blocker], speaker, onClose: release });
        }
      },
    });
  }

  const showHelp = () => say(HELP_PAGES, 'HELP');

  // ---------- NPCs ----------

  function updateNpcs(dt: number) {
    for (const n of npcs) {
      n.timer -= dt;
      if (!n.moving && !n.talking && n.timer <= 0) {
        if (n.wander) {
          const dir = pick(DIR_NAMES);
          const [dx, dy] = DIRS[dir], w = n.wander;
          const nx = n.x + dx, ny = n.y + dy;
          if (nx >= w.x1 && nx <= w.x2 && ny >= w.y1 && ny <= w.y2) tryStep(n, dir);
          else n.dir = dir;
          n.timer = 0.8 + Math.random() * 2.5;
        } else {
          n.dir = Math.random() < 0.6 ? n.homeDir : pick<Dir>(['left', 'right']);
          n.timer = 2 + Math.random() * 4;
        }
      }
      advance(n, dt, NPC_SPEED);
    }
  }

  // ---------- camera & rendering ----------

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const zoom = Math.max(2, Math.min(4, Math.round(Math.min(w / (TILE * 22), h / (TILE * 13)))));
    S = Math.max(1, Math.round(zoom * dpr));
  }

  function updateCamera() {
    const viewW = canvas.width / S, viewH = canvas.height / S;
    const worldW = MAP_W * TILE, worldH = MAP_H * TILE;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    cam.x = worldW <= viewW ? (worldW - viewW) / 2 : clamp(player.px + 8 - viewW / 2, 0, worldW - viewW);
    cam.y = worldH <= viewH ? (worldH - viewH) / 2 : clamp(player.py + 8 - viewH / 2, 0, worldH - viewH);
    cam.ox = -Math.round(cam.x * S);
    cam.oy = -Math.round(cam.y * S);
  }

  const toScreen = (wx: number, wy: number) => [wx * S + cam.ox, wy * S + cam.oy];

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function drawEntity(e: Entity) {
    ctx.drawImage(e.sprites[e.dir][frameOf(e)], Math.round(e.px * S) / S, Math.round((e.py - 6) * S) / S);
  }

  function drawMarker() {
    if (!marker) return;
    const a = Math.max(0, 1 - marker.t / 1.2);
    ctx.fillStyle = marker.ok ? `rgba(255,255,255,${a})` : `rgba(255,90,90,${a})`;
    const x = marker.x * TILE, y = marker.y * TILE, inset = Math.sin(marker.t * 10) > 0 ? 1 : 0;
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
      const ox = x + cx + sx * inset, oy = y + cy + sy * inset;
      ctx.fillRect(Math.min(ox, ox + sx * 3), oy, 4, 1);
      ctx.fillRect(ox, Math.min(oy, oy + sy * 3), 1, 4);
    }
  }

  function tagFont() {
    const size = Math.max(8, Math.round(S * 2.2));
    ctx.font = `${size}px ${fontFamily}`;
    return size;
  }

  // Returns the top edge of the tag so bubbles can stack above it.
  function drawNameTag(e: Entity, label: string, presence: Presence, isMe: boolean) {
    const fs = tagFont();
    const pad = Math.round(fs * 0.6), dot = Math.round(fs * 0.7);
    const w = ctx.measureText(label).width;
    const bw = Math.round(w + pad * 2.6 + dot), bh = Math.round(fs + pad * 1.2);
    const [sx, sy] = toScreen(e.px + 8, e.py - 7);
    const bx = Math.round(sx - bw / 2), by = Math.round(sy - bh);
    ctx.fillStyle = isMe ? 'rgba(47,140,99,.92)' : 'rgba(22,19,31,.8)';
    roundRect(bx, by, bw, bh, Math.round(fs * 0.4));
    ctx.fillStyle = PRESENCE[presence].color;
    ctx.fillRect(bx + pad, Math.round(by + bh / 2 - dot / 2), dot, dot);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + pad * 1.6 + dot, by + bh / 2 + 1);
    return by;
  }

  function drawBubble(sx: number, bottom: number, text: string) {
    const fs = tagFont();
    const pad = Math.round(fs * 0.55);
    const bob = Math.round(Math.sin(time * 6) * fs * 0.25);
    const label = `E  ${text}`;
    const bw = Math.round(ctx.measureText(label).width + pad * 2), bh = Math.round(fs + pad * 1.6);
    const bx = Math.round(sx - bw / 2), by = Math.round(bottom - bh - fs * 0.5 + bob);
    ctx.fillStyle = '#2b2840';
    roundRect(bx - 2, by - 2, bw + 4, bh + 4, 4);
    ctx.fillStyle = '#fdf6e3';
    roundRect(bx, by, bw, bh, 3);
    ctx.fillStyle = '#2b2840';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + pad, by + bh / 2 + 1);
  }

  // Paper cup in the right hand, lifted to the mouth for the middle of the sip.
  function drawCup() {
    const p = 1 - drinkTimer / DRINK_TIME;
    const lift = p < 0.2 ? p / 0.2 : p > 0.85 ? (1 - p) / 0.15 : 1;
    const x = Math.round(player.px) + 10;
    const y = Math.round(player.py + 8 - lift * 5);
    rect(ctx, '#1c1726', x - 1, y - 1, 5, 5);
    rect(ctx, '#f4f4f4', x, y, 3, 3);
    rect(ctx, '#4fb3ff', x, y, 3, 1);
  }

  function drawDrop(tagTop: number) {
    const unit = Math.max(2, Math.round(S * 0.75));
    const bob = Math.round(Math.abs(Math.sin(time * 7)) * unit * 2);
    const [sx] = toScreen(player.px + 8, 0);
    const x0 = Math.round(sx - (DROP[0].length * unit) / 2);
    const y0 = Math.round(tagTop - DROP.length * unit - unit * 2 - bob);
    DROP.forEach((row, j) => [...row].forEach((c, i) => {
      if (DROP_COLORS[c]) rect(ctx, DROP_COLORS[c], x0 + i * unit, y0 + j * unit, unit, unit);
    }));
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#16131f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(S, 0, 0, S, cam.ox, cam.oy);
    ctx.drawImage(mapImage, 0, 0);
    if (openFridge) {
      ctx.save();
      ctx.translate(openFridge.x * TILE, openFridge.y * TILE);
      paintOpenFridge(ctx);
      ctx.restore();
    }
    drawMarker();
    for (const e of [player, ...npcs].sort((a, b) => a.py - b.py)) drawEntity(e);
    if (drinkTimer > 0) drawCup();

    // Screen-space overlays (crisp text at any zoom)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const { started, player: me } = ui();
    const tagTop = new Map<Npc, number>();
    for (const n of npcs) {
      const person = getPerson(n.id, me.name);
      tagTop.set(n, drawNameTag(n, firstName(person.name), person.status, false));
    }
    if (started) {
      const top = drawNameTag(player, me.name, 'online', true);
      if (drinkTimer > 0) drawDrop(top);
    }

    if (mode() === 'play' && drinkTimer <= 0) {
      const f = findFocus();
      if (f && 'npc' in f) drawBubble(toScreen(f.npc.px + 8, 0)[0], tagTop.get(f.npc)!, 'Talk');
      else if (f && HIGHLIGHT[f.tile]) {
        const [sx, sy] = toScreen(f.x * TILE + 8, f.y * TILE);
        drawBubble(sx, sy, HIGHLIGHT[f.tile]);
      }
    }
  }

  // ---------- input ----------

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, select, textarea')) {
      if (e.key === 'Escape') target.blur();
      return;
    }
    running = e.shiftKey;
    const k = e.key.toLowerCase();
    const dir = KEY_DIRS[k];
    // Track held directions in every mode, so a key that dismisses a dialog
    // starts walking straight away. planStep only moves while playing.
    if (dir && !dirs.includes(dir)) dirs.push(dir);
    if (mode() !== 'play') return; // dialog + modal components handle their own keys
    if (dir) { e.preventDefault(); return; }
    if (drinkTimer > 0) return; // let them finish their sip
    if (e.repeat) return;
    if (k === 'e' || k === ' ' || k === 'enter') { interact(); e.preventDefault(); }
    else if (k === 'b') ui().openModal({ kind: 'board' });
    else if (k === 't') ui().toggleTeam();
    else if (k === 'u') ui().openModal({ kind: 'status' });
    else if (k === '?' || k === 'h') showHelp();
    else if (k === 'escape') ui().toggleTeam(false);
  }

  function onKeyUp(e: KeyboardEvent) {
    const dir = KEY_DIRS[e.key.toLowerCase()];
    if (dir) dirs = dirs.filter(d => d !== dir);
    running = e.shiftKey;
  }

  function onBlur() { dirs = []; running = false; }

  function onPointerDown(e: PointerEvent) {
    if (mode() !== 'play' || drinkTimer > 0) return;
    const r = canvas.getBoundingClientRect();
    const wx = ((e.clientX - r.left) * dpr - cam.ox) / S;
    const wy = ((e.clientY - r.top) * dpr - cam.oy) / S;
    const tx = Math.floor(wx / TILE);
    let ty = Math.floor(wy / TILE);
    // Heads poke ~6px into the tile above; clicking a head counts as clicking the person.
    if (!npcAt(tx, ty) && npcAt(tx, ty + 1) && wy - ty * TILE > TILE - 7) ty += 1;
    walkTo(tx, ty);
  }

  // Don't let a clicked button keep focus, or SPACE would press it again.
  function onClick(e: MouseEvent) {
    const b = (e.target as HTMLElement | null)?.closest?.('button');
    if (b && !b.closest('form')) b.blur();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', resize);
  document.addEventListener('click', onClick);
  canvas.addEventListener('pointerdown', onPointerDown);

  const unsubscribe = useOffice.subscribe((s, prev) => {
    if (s.player.look !== prev.player.look) player.sprites = spritesFor(s.player.look);
    if (s.started && !prev.started) checkZone();
    if (getMode(s) !== 'play' && getMode(prev) === 'play') { dirs = []; cancelPath(); }
    if (s.modal?.kind !== 'fridge') openFridge = null; // door shuts when you close the panel
  });

  // ---------- loop ----------

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    updatePlayer(dt);
    updateNpcs(dt);
    updateCamera();
    if (marker && (marker.t += dt) > 1.2) marker = null;
    render();
    raf = requestAnimationFrame(loop);
  }

  resize();
  raf = requestAnimationFrame(loop);

  return {
    walkToPerson: id => walkToPerson(id),
    destroy() {
      cancelAnimationFrame(raf);
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      document.removeEventListener('click', onClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
    },
  };
}
