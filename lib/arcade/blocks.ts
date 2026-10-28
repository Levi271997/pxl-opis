// Block Drop: stack the falling pieces and clear full rows.

import { fill, SCREEN_H, SCREEN_W, type Button, type Game } from './types';

const COLS = 10;
const ROWS = 18;
const CELL = 8;
const FIELD_X = 8;
const PANEL_X = FIELD_X + COLS * CELL + 10;

type Matrix = number[][];
const SHAPES: { m: Matrix; color: string }[] = [
  { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#4fb3ff' },
  { m: [[1, 1], [1, 1]], color: '#ffd84d' },
  { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#8e6bd8' },
  { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#5fcf5a' },
  { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#d64545' },
  { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#5b8def' },
  { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f2a33a' },
];
const LINE_POINTS = [0, 100, 300, 500, 800];

const rotate = (m: Matrix): Matrix => m[0].map((_, i) => m.map(row => row[i]).reverse());

interface Piece { m: Matrix; color: string; x: number; y: number }

export function createBlocks(): Game {
  const field: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let bag: number[] = [];
  let lines = 0;
  let fallTimer = 0;
  let slide = { dir: null as Button | null, timer: 0 }; // holding left/right repeats

  const level = () => 1 + Math.floor(lines / 10);
  const fallTime = () => Math.max(0.08, 0.8 - (level() - 1) * 0.07);

  // Every piece once per bag, in random order: no long droughts.
  function nextShape() {
    if (!bag.length) {
      bag = SHAPES.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return SHAPES[bag.pop()!];
  }

  const spawn = (s: { m: Matrix; color: string }): Piece =>
    ({ m: s.m, color: s.color, x: Math.floor((COLS - s.m.length) / 2), y: s.m === SHAPES[0].m ? -1 : 0 });

  function fits(m: Matrix, x: number, y: number) {
    return m.every((row, j) => row.every((v, i) => {
      if (!v) return true;
      const fx = x + i, fy = y + j;
      return fx >= 0 && fx < COLS && fy < ROWS && (fy < 0 || !field[fy][fx]);
    }));
  }

  let piece = spawn(nextShape());
  let next = nextShape();

  function lock() {
    piece.m.forEach((row, j) => row.forEach((v, i) => {
      if (v && piece.y + j >= 0) field[piece.y + j][piece.x + i] = piece.color;
    }));
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (field[y].every(Boolean)) {
        field.splice(y, 1);
        field.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    game.score += LINE_POINTS[cleared] * level();
    lines += cleared;
    piece = spawn(next);
    next = nextShape();
    if (!fits(piece.m, piece.x, piece.y)) game.over = true;
  }

  function shift(dx: number) {
    if (fits(piece.m, piece.x + dx, piece.y)) piece.x += dx;
  }

  function turn() {
    const m = rotate(piece.m);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(m, piece.x + kick, piece.y)) {
        piece.m = m;
        piece.x += kick;
        return;
      }
    }
  }

  function drop() {
    if (fits(piece.m, piece.x, piece.y + 1)) piece.y++;
    else lock();
  }

  function ghostY() {
    let y = piece.y;
    while (fits(piece.m, piece.x, y + 1)) y++;
    return y;
  }

  function drawCell(g: CanvasRenderingContext2D, color: string, x: number, y: number) {
    fill(g, color, x, y, CELL, CELL);
    fill(g, 'rgba(255,255,255,.35)', x, y, CELL, 1);
    fill(g, 'rgba(255,255,255,.35)', x, y, 1, CELL);
    fill(g, 'rgba(0,0,0,.3)', x, y + CELL - 1, CELL, 1);
    fill(g, 'rgba(0,0,0,.3)', x + CELL - 1, y, 1, CELL);
  }

  const game: Game = {
    score: 0,
    over: false,
    update(dt, input) {
      if (input.pressed.has('up')) turn();
      if (input.pressed.has('action')) {
        const y = ghostY();
        game.score += (y - piece.y) * 2;
        piece.y = y;
        lock();
        fallTimer = 0;
        return;
      }

      for (const dir of ['left', 'right'] as const) {
        if (input.pressed.has(dir)) {
          shift(dir === 'left' ? -1 : 1);
          slide = { dir, timer: -0.17 }; // short pause before it starts repeating
        }
      }
      if (slide.dir && input.held[slide.dir]) {
        slide.timer += dt;
        while (slide.timer >= 0.05) {
          slide.timer -= 0.05;
          shift(slide.dir === 'left' ? -1 : 1);
        }
      } else slide.dir = null;

      fallTimer += dt;
      const interval = input.held.down ? Math.min(0.04, fallTime()) : fallTime();
      while (fallTimer >= interval && !game.over) {
        fallTimer -= interval;
        if (input.held.down) game.score += 1;
        drop();
      }
      game.info = `Lines ${lines} · Level ${level()}`;
    },
    draw(g) {
      fill(g, '#2b2840', 0, 0, SCREEN_W, SCREEN_H);
      fill(g, '#1b1730', FIELD_X, 0, COLS * CELL, ROWS * CELL);
      g.fillStyle = '#231f38';
      for (let x = 1; x < COLS; x++) g.fillRect(FIELD_X + x * CELL, 0, 1, ROWS * CELL);

      field.forEach((row, y) => row.forEach((c, x) => c && drawCell(g, c, FIELD_X + x * CELL, y * CELL)));

      const gy = ghostY();
      piece.m.forEach((row, j) => row.forEach((v, i) => {
        if (!v) return;
        const x = FIELD_X + (piece.x + i) * CELL;
        if (gy + j >= 0) {
          g.strokeStyle = 'rgba(255,255,255,.3)';
          g.strokeRect(x + 0.5, (gy + j) * CELL + 0.5, CELL - 1, CELL - 1);
        }
        if (piece.y + j >= 0) drawCell(g, piece.color, x, (piece.y + j) * CELL);
      }));

      // Next piece preview.
      fill(g, '#1b1730', PANEL_X, 8, 44, 36);
      fill(g, '#efe6d6', PANEL_X, 8, 44, 1);
      const n = next.m.length;
      next.m.forEach((row, j) => row.forEach((v, i) => {
        if (v) drawCell(g, next.color, PANEL_X + 22 - (n * CELL) / 2 + i * CELL, 26 - (n * CELL) / 2 + j * CELL);
      }));
    },
  };
  return game;
}
