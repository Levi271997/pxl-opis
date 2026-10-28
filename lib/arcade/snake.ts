// Snake: eat the coffee beans, don't bite yourself or the walls.

import { fill, SCREEN_H, SCREEN_W, type Button, type Game } from './types';

const CELL = 10;
const COLS = SCREEN_W / CELL;
const ROWS = Math.floor(SCREEN_H / CELL);
const TOP = SCREEN_H - ROWS * CELL; // leftover pixels sit above the field

interface Pt { x: number; y: number }
const DIRS: Partial<Record<Button, Pt>> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

export function createSnake(): Game {
  const snake: Pt[] = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
  let dir: Pt = { x: 1, y: 0 };
  const queue: Pt[] = []; // turns pressed faster than the snake moves
  let step = 0.13;
  let timer = 0;
  let food = placeFood();

  function placeFood(): Pt {
    const free: Pt[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
    }
    return free[Math.floor(Math.random() * free.length)];
  }

  const game: Game = {
    score: 0,
    over: false,
    update(dt, input) {
      for (const b of input.pressed) {
        const d = DIRS[b];
        const lastDir = queue[queue.length - 1] ?? dir;
        if (d && queue.length < 2 && d.x !== -lastDir.x && d.y !== -lastDir.y) queue.push(d);
      }
      timer += dt;
      while (timer >= step && !game.over) {
        timer -= step;
        dir = queue.shift() ?? dir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const eating = head.x === food?.x && head.y === food?.y;
        const body = eating ? snake : snake.slice(0, -1); // the tail moves out of the way
        if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || body.some(s => s.x === head.x && s.y === head.y)) {
          game.over = true;
          return;
        }
        snake.unshift(head);
        if (eating) {
          game.score += 10;
          step = Math.max(0.06, step - 0.003);
          food = placeFood();
          if (!food) game.over = true; // the whole screen is snake: you win
        } else snake.pop();
      }
      game.info = `Length ${snake.length}`;
    },
    draw(g) {
      fill(g, '#1b1730', 0, 0, SCREEN_W, SCREEN_H);
      fill(g, '#2b2840', 0, 0, SCREEN_W, TOP);
      g.fillStyle = '#26223c';
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2) g.fillRect(x * CELL, TOP + y * CELL, CELL, CELL);
      }
      if (food) {
        const fx = food.x * CELL, fy = TOP + food.y * CELL;
        fill(g, '#6b3f22', fx + 2, fy + 2, 6, 6);
        fill(g, '#8a5530', fx + 3, fy + 3, 2, 4);
        fill(g, '#3d2213', fx + 5, fy + 3, 1, 4);
      }
      snake.forEach((s, i) => {
        const sx = s.x * CELL, sy = TOP + s.y * CELL;
        fill(g, i === 0 ? '#5fcf5a' : i % 2 ? '#9be37a' : '#8cd66c', sx + 1, sy + 1, CELL - 2, CELL - 2);
        if (i === 0) {
          // eyes look where you're going
          const ex = dir.x === 0 ? [3, 6] : dir.x > 0 ? [6, 6] : [3, 3];
          const ey = dir.y === 0 ? [3, 6] : dir.y > 0 ? [6, 6] : [3, 3];
          fill(g, '#1b1730', sx + ex[0], sy + ey[0], 1, 1);
          fill(g, '#1b1730', sx + ex[1], sy + ey[1], 1, 1);
        }
      });
    },
  };
  return game;
}
