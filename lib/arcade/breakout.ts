// Breakout: bounce the ball off the paddle and clear every brick.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const BRICK_COLS = 8;
const BRICK_ROWS = 5;
const BRICK_W = 18;
const BRICK_H = 6;
const GAP = 2;
const BRICKS_X = (SCREEN_W - BRICK_COLS * (BRICK_W + GAP) + GAP) / 2;
const BRICKS_Y = 16;
const ROW_COLORS = ['#d64545', '#f2a33a', '#ffd84d', '#9be37a', '#5b8def'];
const PADDLE_Y = SCREEN_H - 10;
const PADDLE_W = 28;
const BALL = 3;

export function createBreakout(): Game {
  let lives = 3;
  let level = 1;
  let paddleX = (SCREEN_W - PADDLE_W) / 2;
  const ball = { x: 0, y: 0, vx: 0, vy: 0, stuck: true };
  let bricks: { x: number; y: number; row: number }[] = [];

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({ x: BRICKS_X + c * (BRICK_W + GAP), y: BRICKS_Y + r * (BRICK_H + GAP), row: r });
    }
  }
  buildBricks();

  const speed = () => 95 + level * 12;

  function launch() {
    ball.stuck = false;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * speed() * 0.55;
    ball.vy = -speed();
  }

  // Move in small steps so a fast ball can't pass through a brick.
  function moveBall(dt: number) {
    const steps = Math.ceil((Math.abs(ball.vx) + Math.abs(ball.vy)) * dt / 2);
    for (let i = 0; i < steps; i++) {
      const px = ball.x, py = ball.y;
      ball.x += ball.vx * dt / steps;
      ball.y += ball.vy * dt / steps;

      if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx); }
      if (ball.x > SCREEN_W - BALL) { ball.x = SCREEN_W - BALL; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }

      // Where on the paddle you hit decides the bounce angle.
      if (ball.vy > 0 && ball.y + BALL >= PADDLE_Y && py + BALL <= PADDLE_Y + 1
        && ball.x + BALL > paddleX && ball.x < paddleX + PADDLE_W) {
        const hit = (ball.x + BALL / 2 - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
        ball.vx = hit * speed() * 1.1;
        ball.vy = -speed();
        ball.y = PADDLE_Y - BALL;
      }

      const hitIndex = bricks.findIndex(b =>
        ball.x + BALL > b.x && ball.x < b.x + BRICK_W && ball.y + BALL > b.y && ball.y < b.y + BRICK_H);
      if (hitIndex >= 0) {
        const b = bricks[hitIndex];
        const cameFromSide = px + BALL <= b.x || px >= b.x + BRICK_W;
        if (cameFromSide) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
        bricks.splice(hitIndex, 1);
        game.score += (BRICK_ROWS - b.row) * 10;
        if (!bricks.length) {
          level++;
          buildBricks();
          ball.stuck = true;
          return;
        }
      }

      if (ball.y > SCREEN_H) {
        lives--;
        ball.stuck = true;
        if (!lives) game.over = true;
        return;
      }
    }
  }

  const game: Game = {
    score: 0,
    over: false,
    update(dt, input) {
      if (input.held.left) paddleX -= 150 * dt;
      if (input.held.right) paddleX += 150 * dt;
      paddleX = Math.max(0, Math.min(SCREEN_W - PADDLE_W, paddleX));

      if (ball.stuck) {
        ball.x = paddleX + PADDLE_W / 2 - BALL / 2;
        ball.y = PADDLE_Y - BALL - 1;
        if (input.pressed.has('action') || input.pressed.has('up')) launch();
      } else moveBall(dt);

      game.info = `Lives ${lives} · Level ${level}${ball.stuck && !game.over ? ' · Space to launch' : ''}`;
    },
    draw(g) {
      fill(g, '#1b1730', 0, 0, SCREEN_W, SCREEN_H);
      for (const b of bricks) {
        fill(g, ROW_COLORS[b.row], b.x, b.y, BRICK_W, BRICK_H);
        fill(g, 'rgba(255,255,255,.35)', b.x, b.y, BRICK_W, 1);
        fill(g, 'rgba(0,0,0,.25)', b.x, b.y + BRICK_H - 1, BRICK_W, 1);
      }
      fill(g, '#efe6d6', paddleX, PADDLE_Y, PADDLE_W, 4);
      fill(g, '#5b8def', paddleX + 2, PADDLE_Y + 1, PADDLE_W - 4, 2);
      fill(g, '#ffffff', ball.x, ball.y, BALL, BALL);
    },
  };
  return game;
}
