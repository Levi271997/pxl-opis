// Paper Plane: tap to keep a paper airplane in the air and fly it through the
// gaps between stacks of filing cabinets. One point per gap; the cabinets
// close in and speed up as you go.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const PLANE_X = 34;
const PLANE_W = 12;
const PLANE_H = 6;
const GRAVITY = 300;
const FLAP = -105;
const CAB_W = 20;
const FLOOR = SCREEN_H - 10;

interface Stack { x: number; gapY: number; gap: number; passed: boolean }

function drawCabinets(g: CanvasRenderingContext2D, x: number, top: number, bottom: number) {
  // A column of filing-cabinet drawers between y = top and y = bottom.
  fill(g, '#6b7280', x, top, CAB_W, bottom - top);
  for (let y = top; y < bottom; y += 12) {
    const h = Math.min(11, bottom - y - 1);
    if (h <= 1) continue;
    fill(g, '#9aa3ad', x + 1, y + 1, CAB_W - 2, h);
    fill(g, '#c9ced4', x + 1, y + 1, CAB_W - 2, 1);
    if (h > 5) fill(g, '#3a3f4b', x + CAB_W / 2 - 3, y + Math.floor(h / 2), 6, 2); // handle
  }
  fill(g, '#4a4e69', x - 1, top === 0 ? bottom - 2 : top, CAB_W + 2, 2); // rim facing the gap
}

export function createPlane(): Game {
  let y = SCREEN_H / 2 - 10;
  let vy = FLAP; // start with a little hop
  let stacks: Stack[] = [];
  let spawnIn = 0.6;
  let scroll = 0;
  let crashed = 0; // seconds of falling after a crash, before game over

  const speed = () => 48 + Math.min(game.score, 30) * 1.2;
  const gapSize = () => Math.max(38, 54 - game.score * 0.6);

  function flap() {
    if (!crashed) vy = FLAP;
  }

  function crash() {
    if (!crashed) crashed = 0.6;
  }

  const game: Game = {
    score: 0,
    over: false,
    click: () => flap(),
    update(dt, input) {
      if (input.pressed.has('action') || input.pressed.has('up')) flap();

      vy = Math.min(vy + GRAVITY * dt, 200);
      y += vy * dt;
      if (y < 0) { y = 0; vy = 0; }
      if (y + PLANE_H >= FLOOR) { y = FLOOR - PLANE_H; crash(); }

      if (crashed) {
        crashed -= dt;
        if (crashed <= 0) game.over = true;
        return;
      }

      scroll = (scroll + speed() * dt) % 16;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const gap = gapSize();
        stacks.push({ x: SCREEN_W, gap, gapY: 14 + Math.random() * (FLOOR - gap - 28), passed: false });
        spawnIn = 1.7 - Math.min(game.score, 20) * 0.02;
      }
      for (const s of stacks) {
        s.x -= speed() * dt;
        if (!s.passed && s.x + CAB_W < PLANE_X) {
          s.passed = true;
          game.score++;
        }
        const overlapX = PLANE_X + PLANE_W - 2 > s.x && PLANE_X + 2 < s.x + CAB_W;
        const outsideGap = y + 1 < s.gapY || y + PLANE_H - 1 > s.gapY + s.gap;
        if (overlapX && outsideGap) crash();
      }
      stacks = stacks.filter(s => s.x > -CAB_W - 2);
      game.info = `Gaps ${game.score} · Speed ${Math.round(speed())}`;
    },
    draw(g) {
      // Office wall with a window, and a carpet floor scrolling past.
      fill(g, '#efe6d6', 0, 0, SCREEN_W, FLOOR);
      fill(g, '#e0d5c1', 0, FLOOR - 26, SCREEN_W, 1);
      const wx = Math.round(-scroll * 2) % 80;
      for (let x = wx; x < SCREEN_W; x += 80) {
        fill(g, '#5b5470', x + 20, 20, 36, 26);
        fill(g, '#8fd3ff', x + 22, 22, 32, 22);
        fill(g, '#c4ecff', x + 24, 24, 10, 6);
        fill(g, '#5b5470', x + 37, 22, 2, 22);
      }
      for (const s of stacks) {
        drawCabinets(g, Math.round(s.x), 0, Math.round(s.gapY));
        drawCabinets(g, Math.round(s.x), Math.round(s.gapY + s.gap), FLOOR);
      }
      fill(g, '#4e5db3', 0, FLOOR, SCREEN_W, SCREEN_H - FLOOR);
      g.fillStyle = '#5a6ac4';
      for (let x = -Math.round(scroll); x < SCREEN_W; x += 8) g.fillRect(x, FLOOR + 3, 4, 1);

      // The plane tilts with its speed: nose up when climbing, down when falling.
      const px = PLANE_X, py = Math.round(y);
      const tilt = vy < -30 ? -1 : vy > 60 ? 1 : 0;
      fill(g, 'rgba(0,0,0,.12)', px + 2, FLOOR - 2, PLANE_W - 2, 2);
      fill(g, '#ffffff', px, py + 2 + tilt, PLANE_W - 2, 2);
      fill(g, '#ffffff', px + 2, py + 1, PLANE_W - 2, 1);
      fill(g, '#ffffff', px + PLANE_W - 2, py + 2 - tilt, 2, 1); // nose
      fill(g, '#c9ced4', px + 1, py + 4 + tilt, PLANE_W - 5, 2); // underside fold
      fill(g, '#5b8def', px + 3, py + 2 + tilt, 4, 1); // stripe
      if (crashed) fill(g, 'rgba(214,69,69,.25)', 0, 0, SCREEN_W, SCREEN_H);
    },
  };
  return game;
}
