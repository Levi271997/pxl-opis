// Whack-a-Bug: bugs pop out of nine laptops. Move the mallet and squash them
// before they ship. Don't hit the features (green ticks) by mistake. The round
// lasts 60 seconds, or until 10 bugs make it to production.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const ROUND = 60;
const MAX_SHIPPED = 10;
const CELL_W = 50;
const CELL_H = 44;
const GRID_X = (SCREEN_W - 3 * CELL_W) / 2;
const GRID_Y = 8;
const SCREEN_W_PX = 30; // laptop screen size
const SCREEN_H_PX = 20;
const RISE = 0.15; // seconds to pop up or duck down

type Kind = 'bug' | 'fast' | 'critical' | 'feature';
const POINTS: Record<Kind, number> = { bug: 10, fast: 20, critical: 50, feature: 0 };

interface Hole {
  kind: Kind | null; // null = nothing there
  age: number; // seconds since it popped up
  life: number; // how long it stays up
  hit: number; // > 0 while the squash animation plays
  points: number; // what the last squash was worth, shown above the laptop
}

const cellX = (i: number) => GRID_X + (i % 3) * CELL_W;
const cellY = (i: number) => GRID_Y + Math.floor(i / 3) * CELL_H;
const screenX = (i: number) => cellX(i) + (CELL_W - SCREEN_W_PX) / 2;
const screenY = (i: number) => cellY(i) + 6;

function pickKind(): Kind {
  const r = Math.random();
  if (r < 0.05) return 'critical';
  if (r < 0.17) return 'feature';
  if (r < 0.35) return 'fast';
  return 'bug';
}

function drawBug(g: CanvasRenderingContext2D, x: number, y: number, kind: Kind, squashed: boolean) {
  if (kind === 'feature') {
    fill(g, '#2f9e6e', x, y, 12, 12);
    fill(g, '#ffffff', x + 2, y + 6, 2, 2);
    fill(g, '#ffffff', x + 4, y + 7, 2, 2);
    fill(g, '#ffffff', x + 6, y + 5, 2, 2);
    fill(g, '#ffffff', x + 8, y + 3, 2, 2);
    return;
  }
  const body = kind === 'critical' ? '#ffd84d' : kind === 'fast' ? '#8e6bd8' : '#d64545';
  const shell = kind === 'critical' ? '#d9a441' : kind === 'fast' ? '#5f45a6' : '#8f2f2f';
  if (squashed) {
    fill(g, body, x - 1, y + 7, 14, 4);
    fill(g, shell, x + 2, y + 8, 8, 2);
    return;
  }
  fill(g, '#1b1730', x + 3, y, 1, 3); // antennae
  fill(g, '#1b1730', x + 8, y, 1, 3);
  fill(g, '#1b1730', x + 3, y + 3, 6, 3); // head
  fill(g, '#ffffff', x + 4, y + 4, 1, 1); // eyes
  fill(g, '#ffffff', x + 7, y + 4, 1, 1);
  fill(g, body, x + 2, y + 6, 8, 6); // shell
  fill(g, shell, x + 6, y + 6, 1, 6);
  fill(g, 'rgba(255,255,255,.4)', x + 3, y + 7, 2, 1);
  fill(g, '#1b1730', x, y + 7, 2, 1); // legs
  fill(g, '#1b1730', x + 10, y + 7, 2, 1);
  fill(g, '#1b1730', x, y + 10, 2, 1);
  fill(g, '#1b1730', x + 10, y + 10, 2, 1);
}

export function createWhack(): Game {
  const holes: Hole[] = Array.from({ length: 9 }, () => ({ kind: null, age: 0, life: 0, hit: 0, points: 0 }));
  let sel = 4;
  let timeLeft = ROUND;
  let shipped = 0;
  let combo = 0;
  let spawnIn = 0.8;
  let swing = 0; // > 0 while the mallet comes down
  let flash = 0; // red flash after breaking a feature or shipping a bug

  // 0 at the start of the round, 1 at the end: everything speeds up.
  const progress = () => 1 - timeLeft / ROUND;

  function ship() {
    shipped++;
    combo = 0;
    flash = 0.3;
    if (shipped >= MAX_SHIPPED) game.over = true;
  }

  function spawn() {
    const free = holes.map((h, i) => (h.kind ? -1 : i)).filter(i => i >= 0);
    if (!free.length) return;
    const h = holes[free[Math.floor(Math.random() * free.length)]];
    h.kind = pickKind();
    h.age = 0;
    h.hit = 0;
    const base = 2 - progress() * 1;
    h.life = h.kind === 'fast' || h.kind === 'critical' ? base * 0.55 : base;
  }

  function whack() {
    swing = 0.12;
    const h = holes[sel];
    if (!h.kind || h.hit || h.age > h.life + RISE) {
      combo = 0; // swung at an empty laptop
      return;
    }
    if (h.kind === 'feature') {
      h.kind = null;
      ship(); // you broke a feature
      return;
    }
    combo++;
    h.points = POINTS[h.kind] * Math.min(combo, 5);
    game.score += h.points;
    h.hit = 0.25;
  }

  const game: Game = {
    score: 0,
    over: false,
    // Clicking or tapping a laptop moves the mallet there and whacks.
    click(x, y) {
      const col = Math.floor((x - GRID_X) / CELL_W), row = Math.floor((y - GRID_Y) / CELL_H);
      if (col < 0 || col > 2 || row < 0 || row > 2) return;
      sel = row * 3 + col;
      whack();
    },
    update(dt, input) {
      const col = sel % 3, row = Math.floor(sel / 3);
      if (input.pressed.has('left') && col > 0) sel--;
      if (input.pressed.has('right') && col < 2) sel++;
      if (input.pressed.has('up') && row > 0) sel -= 3;
      if (input.pressed.has('down') && row < 2) sel += 3;
      if (input.pressed.has('action')) whack();

      timeLeft = Math.max(0, timeLeft - dt);
      swing = Math.max(0, swing - dt);
      flash = Math.max(0, flash - dt);

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        if (progress() > 0.5 && Math.random() < 0.3) spawn(); // two at once later on
        spawnIn = 1.1 - progress() * 0.6;
      }

      for (const h of holes) {
        if (!h.kind) continue;
        if (h.hit) {
          h.hit -= dt;
          if (h.hit <= 0) { h.kind = null; h.hit = 0; }
          continue;
        }
        h.age += dt;
        if (h.age > h.life + 2 * RISE) {
          const escaped = h.kind !== 'feature';
          h.kind = null;
          if (escaped) ship();
        }
      }

      if (timeLeft <= 0) game.over = true;
      game.info = `Time ${Math.ceil(timeLeft)} · Shipped ${shipped}/${MAX_SHIPPED}${combo > 1 ? ` · Combo x${Math.min(combo, 5)}` : ''}`;
    },
    draw(g) {
      fill(g, '#c79f74', 0, 0, SCREEN_W, SCREEN_H); // desk
      g.fillStyle = '#b38a60';
      for (let y = 3; y < SCREEN_H; y += 6) g.fillRect(0, y, SCREEN_W, 1);
      if (flash) fill(g, `rgba(214,69,69,${flash})`, 0, 0, SCREEN_W, SCREEN_H);

      holes.forEach((h, i) => {
        const sx = screenX(i), sy = screenY(i);
        // Laptop: lid with a screen, then the keyboard base.
        fill(g, 'rgba(0,0,0,.2)', sx - 3, sy + SCREEN_H_PX + 6, SCREEN_W_PX + 6, 2);
        fill(g, '#5b5470', sx - 2, sy - 2, SCREEN_W_PX + 4, SCREEN_H_PX + 4);
        fill(g, '#1b1730', sx, sy, SCREEN_W_PX, SCREEN_H_PX);
        fill(g, '#9aa3ad', sx - 4, sy + SCREEN_H_PX + 2, SCREEN_W_PX + 8, 4);
        fill(g, '#c9ced4', sx - 4, sy + SCREEN_H_PX + 2, SCREEN_W_PX + 8, 1);

        if (h.kind) {
          // Pops up from the bottom of the screen, stays, then ducks back down.
          const up = h.hit ? 1 : Math.min(1, h.age / RISE, Math.max(0, (h.life + 2 * RISE - h.age) / RISE));
          g.save();
          g.beginPath();
          g.rect(sx, sy, SCREEN_W_PX, SCREEN_H_PX);
          g.clip();
          drawBug(g, sx + SCREEN_W_PX / 2 - 6, sy + SCREEN_H_PX - Math.round(up * 15), h.kind, h.hit > 0);
          g.restore();
          if (h.hit) {
            g.fillStyle = '#ffffff';
            g.font = '7px monospace';
            g.fillText(`+${h.points}`, sx + SCREEN_W_PX - 2, sy - 3);
          }
        } else {
          fill(g, '#2b4f7a', sx + 2, sy + 2, 4, 1); // idle screen: a line of code
          fill(g, '#2b4f7a', sx + 4, sy + 5, 8, 1);
        }
      });

      // The mallet over the selected laptop: a frame, then the hammer.
      const sx = screenX(sel), sy = screenY(sel);
      g.strokeStyle = '#ffd84d';
      g.lineWidth = 1;
      g.strokeRect(sx - 4.5, sy - 4.5, SCREEN_W_PX + 9, SCREEN_H_PX + 13);
      const drop = swing ? 8 : 0;
      const hx = sx + SCREEN_W_PX - 4, hy = sy - 10 + drop;
      fill(g, '#8a5530', hx + 4, hy + 4, 2, 10); // handle
      fill(g, '#d64545', hx, hy, 10, 5); // head
      fill(g, '#ff8f8f', hx + 1, hy + 1, 3, 1);

      // Time bar along the bottom.
      fill(g, '#3a3450', 0, SCREEN_H - 3, SCREEN_W, 3);
      fill(g, timeLeft < 10 ? '#d64545' : '#5fcf5a', 0, SCREEN_H - 3, (SCREEN_W * timeLeft) / ROUND, 3);
    },
  };
  return game;
}
