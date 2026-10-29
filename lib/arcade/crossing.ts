// Office Crossing: carry a coffee from the bottom of the office to the team
// desk at the top, hopping across aisles full of rolling chairs, mail carts,
// robot vacuums and printer carts. Each delivery makes everything faster.

import { fill, SCREEN_H, SCREEN_W, type Button, type Game } from './types';

const CELL_W = 10;
const COLS = SCREEN_W / CELL_W; // 16
const ROW_H = 12;
const ROWS = SCREEN_H / ROW_H; // 12: row 0 is the desk, row 11 the start
const START = { col: 7, row: ROWS - 1 };
const SAFE_ROW = 6; // the rug in the middle
const HOP_TIME = 0.1;

type Kind = 'chair' | 'cart' | 'vacuum' | 'printer';
const WIDTH: Record<Kind, number> = { chair: 10, cart: 22, vacuum: 10, printer: 32 };

interface Lane { row: number; kind: Kind; dir: number; speed: number; xs: number[] }

// Each aisle: what rolls along it, which way, how fast, and how many.
const LANES: { row: number; kind: Kind; dir: number; speed: number; count: number }[] = [
  { row: 10, kind: 'chair', dir: 1, speed: 22, count: 4 },
  { row: 9, kind: 'cart', dir: -1, speed: 28, count: 3 },
  { row: 8, kind: 'vacuum', dir: 1, speed: 40, count: 3 },
  { row: 7, kind: 'printer', dir: -1, speed: 18, count: 2 },
  { row: 5, kind: 'cart', dir: 1, speed: 32, count: 2 },
  { row: 4, kind: 'chair', dir: -1, speed: 30, count: 4 },
  { row: 3, kind: 'printer', dir: 1, speed: 24, count: 2 },
  { row: 2, kind: 'vacuum', dir: -1, speed: 48, count: 3 },
  { row: 1, kind: 'chair', dir: 1, speed: 36, count: 3 },
];

function drawThing(g: CanvasRenderingContext2D, kind: Kind, x: number, y: number) {
  x = Math.round(x);
  fill(g, 'rgba(0,0,0,.2)', x + 1, y + ROW_H - 3, WIDTH[kind] - 1, 2);
  if (kind === 'chair') {
    fill(g, '#3a3f4b', x + 1, y + 2, 8, 6); // back and seat
    fill(g, '#5b8def', x + 2, y + 3, 6, 4);
    fill(g, '#1b1730', x + 1, y + 9, 2, 2); // wheels
    fill(g, '#1b1730', x + 7, y + 9, 2, 2);
  } else if (kind === 'cart') {
    fill(g, '#9aa3ad', x, y + 3, 22, 6);
    fill(g, '#efe6d6', x + 2, y + 1, 5, 4); // letters and parcels
    fill(g, '#c99a5c', x + 8, y + 1, 7, 4);
    fill(g, '#efe6d6', x + 16, y + 2, 4, 3);
    fill(g, '#1b1730', x + 2, y + 9, 2, 2);
    fill(g, '#1b1730', x + 18, y + 9, 2, 2);
  } else if (kind === 'vacuum') {
    fill(g, '#2b2840', x + 1, y + 3, 8, 7);
    fill(g, '#463f5f', x + 2, y + 4, 6, 5);
    fill(g, '#5fcf5a', x + 4, y + 5, 2, 1); // status light
  } else {
    fill(g, '#c9ced4', x, y + 1, 32, 8);
    fill(g, '#9aa3ad', x, y + 6, 32, 3);
    fill(g, '#2b2840', x + 4, y + 2, 12, 2); // paper slot
    fill(g, '#ffffff', x + 6, y, 8, 2); // paper
    fill(g, '#d64545', x + 26, y + 3, 2, 2);
    fill(g, '#1b1730', x + 3, y + 9, 2, 2);
    fill(g, '#1b1730', x + 27, y + 9, 2, 2);
  }
}

export function createCrossing(): Game {
  let col = START.col, row = START.row;
  let hop = 0; // > 0 while mid-hop
  let lives = 3;
  let level = 1;
  let delivered = 0;
  let best = START.row; // furthest row reached on this trip (smaller = further)
  let hurt = 0; // blinking after getting run over
  let celebrate = 0; // after a delivery
  // Evenly spaced along each aisle, but every aisle starts at a random point,
  // so there's no free path straight up the middle at the start.
  const lanes: Lane[] = LANES.map(l => {
    const offset = Math.random() * SCREEN_W;
    return {
      row: l.row, kind: l.kind, dir: l.dir, speed: l.speed,
      xs: Array.from({ length: l.count }, (_, i) => ((i * SCREEN_W) / l.count + offset + Math.random() * 12) % SCREEN_W),
    };
  });

  const speedFactor = () => 1 + (level - 1) * 0.15;

  function resetTrip() {
    col = START.col;
    row = START.row;
    best = START.row;
  }

  function move(b: Button) {
    if (hop > 0 || celebrate > 0) return;
    if (b === 'up' && row > 0) row--;
    else if (b === 'down' && row < ROWS - 1) row++;
    else if (b === 'left' && col > 0) col--;
    else if (b === 'right' && col < COLS - 1) col++;
    else return;
    hop = HOP_TIME;
    if (row < best) {
      game.score += 10 * (best - row);
      best = row;
    }
    if (row === 0) {
      delivered++;
      game.score += 100 + 20 * level;
      level++;
      celebrate = 0.8;
    }
  }

  const game: Game = {
    score: 0,
    over: false,
    // Click or tap above, below or beside your character to hop that way.
    click(x, y) {
      const dx = x - (col * CELL_W + CELL_W / 2), dy = y - (row * ROW_H + ROW_H / 2);
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    },
    update(dt, input) {
      for (const b of ['up', 'down', 'left', 'right'] as const) if (input.pressed.has(b)) move(b);
      hop = Math.max(0, hop - dt);
      hurt = Math.max(0, hurt - dt);
      if (celebrate > 0) {
        celebrate -= dt;
        if (celebrate <= 0) resetTrip();
      }

      for (const lane of lanes) {
        const w = WIDTH[lane.kind];
        lane.xs = lane.xs.map(x => {
          let nx = x + lane.dir * lane.speed * speedFactor() * dt;
          if (nx > SCREEN_W) nx -= SCREEN_W + w;
          if (nx < -w) nx += SCREEN_W + w;
          return nx;
        });
        if (lane.row !== row || hurt || celebrate > 0) continue;
        const px = col * CELL_W + 2, pw = CELL_W - 4;
        if (lane.xs.some(x => px < x + w - 1 && px + pw > x + 1)) {
          lives--;
          hurt = 1.2;
          resetTrip();
          if (!lives) game.over = true;
        }
      }
      game.info = `Lives ${lives} · Level ${level} · Delivered ${delivered}`;
    },
    draw(g) {
      for (let r = 0; r < ROWS; r++) {
        const y = r * ROW_H;
        if (r === 0) {
          // The team desk you deliver to.
          fill(g, '#4e5db3', 0, y, SCREEN_W, ROW_H);
          for (let x = 4; x < SCREEN_W; x += 30) {
            fill(g, '#6e4322', x, y + 2, 24, 8);
            fill(g, '#8a5a35', x, y + 2, 24, 2);
            fill(g, '#3a3450', x + 4, y + 3, 7, 4);
          }
        } else if (r === START.row) {
          fill(g, '#4e5db3', 0, y, SCREEN_W, ROW_H);
        } else if (r === SAFE_ROW) {
          fill(g, '#a33f3c', 0, y, SCREEN_W, ROW_H);
          fill(g, '#d9b45a', 0, y + 1, SCREEN_W, 1);
          fill(g, '#d9b45a', 0, y + ROW_H - 2, SCREEN_W, 1);
        } else {
          fill(g, r % 2 ? '#c79f74' : '#bf956a', 0, y, SCREEN_W, ROW_H); // wooden aisle
          fill(g, '#b38a60', 0, y + ROW_H - 1, SCREEN_W, 1);
        }
      }
      for (const lane of lanes) for (const x of lane.xs) drawThing(g, lane.kind, x, lane.row * ROW_H);

      // You, carrying a coffee. A little hop when moving.
      if (!hurt || Math.floor(hurt * 10) % 2 === 0) {
        const x = col * CELL_W + 2, y = row * ROW_H + 1 - (hop > 0 ? 2 : 0);
        fill(g, 'rgba(0,0,0,.2)', x, row * ROW_H + ROW_H - 2, 6, 2);
        fill(g, '#5a3825', x + 1, y, 4, 2); // hair
        fill(g, '#e8b58a', x + 1, y + 2, 4, 3); // face
        fill(g, '#3fb27f', x, y + 5, 6, 4); // shirt
        fill(g, '#2d3047', x + 1, y + 9, 4, 2); // legs
        fill(g, '#ffffff', x + 6, y + 4, 3, 3); // the coffee
        fill(g, '#6b3f22', x + 6, y + 4, 3, 1);
      }
      if (celebrate > 0) {
        g.fillStyle = '#ffd84d';
        g.font = '8px monospace';
        g.textAlign = 'center';
        g.fillText('Delivered!', SCREEN_W / 2, ROW_H * 3);
        g.textAlign = 'start';
      }
    },
  };
  return game;
}
