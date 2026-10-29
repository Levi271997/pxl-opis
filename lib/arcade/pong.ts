// Break Room Pong: table tennis against Omar. Every point you win is worth
// more, and every 3 points Omar gets quicker and the ball gets faster. Omar
// scoring costs you a life; three lives.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const PADDLE_W = 3;
const PADDLE_H = 22;
const BALL = 3;
const YOU_X = 8;
const OMAR_X = SCREEN_W - 8 - PADDLE_W;
const TOP = 6; // table edges
const BOTTOM = SCREEN_H - 6;

export function createPong(): Game {
  let you = (SCREEN_H - PADDLE_H) / 2;
  let omar = you;
  let target: number | null = null; // where a click asked your paddle to go
  let lives = 3;
  let level = 1;
  let yourPoints = 0;
  let omarPoints = 0;
  let rally = 0;
  let omarError = 0; // how far off Omar is aiming this return
  let serveIn = 0.8;
  const ball = { x: SCREEN_W / 2, y: SCREEN_H / 2, vx: 0, vy: 0 };
  let toward = 1; // who gets served at: 1 = Omar, -1 = you

  const baseSpeed = () => 70 + level * 8;
  const omarSpeed = () => 55 + level * 12;

  function serve() {
    ball.x = SCREEN_W / 2 - BALL / 2;
    ball.y = SCREEN_H / 2 - BALL / 2;
    const angle = (Math.random() - 0.5) * 0.9;
    ball.vx = Math.cos(angle) * baseSpeed() * toward;
    ball.vy = Math.sin(angle) * baseSpeed();
    rally = 0;
  }

  // Where the ball hits the paddle sets the angle; each hit speeds it up a bit.
  function bounce(paddleY: number, dir: number) {
    const hit = (ball.y + BALL / 2 - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.05, 190);
    const angle = hit * 1.0;
    ball.vx = Math.cos(angle) * speed * dir;
    ball.vy = Math.sin(angle) * speed;
    rally++;
    if (dir > 0) omarError = (Math.random() - 0.5) * (3 + rally * 2);
  }

  function point(winner: 'you' | 'omar') {
    if (winner === 'you') {
      yourPoints++;
      game.score += 10 * level + rally * 2;
      if (yourPoints % 3 === 0) level++;
      toward = 1;
    } else {
      omarPoints++;
      lives--;
      if (!lives) game.over = true;
      toward = -1;
    }
    ball.vx = ball.vy = 0;
    serveIn = 0.8;
  }

  const game: Game = {
    score: 0,
    over: false,
    click(_x, y) {
      target = y - PADDLE_H / 2;
    },
    update(dt, input) {
      if (input.held.up || input.held.down) target = null;
      if (input.held.up) you -= 130 * dt;
      if (input.held.down) you += 130 * dt;
      if (target !== null) {
        const step = 160 * dt;
        you += Math.max(-step, Math.min(step, target - you));
      }
      you = Math.max(TOP, Math.min(BOTTOM - PADDLE_H, you));

      // Omar follows the ball when it's coming his way, and drifts to the
      // middle otherwise. Each return he misjudges the ball a little (see
      // bounce), more the longer the rally, so he can be beaten.
      const aim = ball.vx > 0 ? ball.y + BALL / 2 - PADDLE_H / 2 + omarError : (SCREEN_H - PADDLE_H) / 2;
      const step = omarSpeed() * dt * (ball.vx > 0 ? 1 : 0.5);
      omar += Math.max(-step, Math.min(step, aim - omar));
      omar = Math.max(TOP, Math.min(BOTTOM - PADDLE_H, omar));

      if (serveIn > 0) {
        serveIn -= dt;
        if (serveIn <= 0) serve();
      } else {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.y < TOP) { ball.y = TOP; ball.vy = Math.abs(ball.vy); }
        if (ball.y + BALL > BOTTOM) { ball.y = BOTTOM - BALL; ball.vy = -Math.abs(ball.vy); }

        if (ball.vx < 0 && ball.x <= YOU_X + PADDLE_W && ball.x + BALL >= YOU_X
          && ball.y + BALL >= you && ball.y <= you + PADDLE_H) {
          ball.x = YOU_X + PADDLE_W;
          bounce(you, 1);
        }
        if (ball.vx > 0 && ball.x + BALL >= OMAR_X && ball.x <= OMAR_X + PADDLE_W
          && ball.y + BALL >= omar && ball.y <= omar + PADDLE_H) {
          ball.x = OMAR_X - BALL;
          bounce(omar, -1);
        }

        if (ball.x + BALL < 0) point('omar');
        else if (ball.x > SCREEN_W) point('you');
      }

      game.info = `You ${yourPoints} – Omar ${omarPoints} · Lives ${lives} · Level ${level}`;
    },
    draw(g) {
      // A green table seen from above: white edges, a centre line and the net.
      fill(g, '#2b2840', 0, 0, SCREEN_W, SCREEN_H);
      fill(g, '#2f7d5b', 2, TOP - 2, SCREEN_W - 4, BOTTOM - TOP + 4);
      fill(g, '#efe6d6', 2, TOP - 2, SCREEN_W - 4, 1);
      fill(g, '#efe6d6', 2, BOTTOM + 1, SCREEN_W - 4, 1);
      fill(g, 'rgba(239,230,214,.5)', 2, SCREEN_H / 2, SCREEN_W - 4, 1);
      for (let y = TOP; y < BOTTOM; y += 6) fill(g, '#c9ced4', SCREEN_W / 2 - 1, y, 2, 4);

      // Big faded score in each half.
      g.fillStyle = 'rgba(255,255,255,.15)';
      g.font = '16px monospace';
      g.textAlign = 'center';
      g.fillText(String(yourPoints), SCREEN_W / 4, 28);
      g.fillText(String(omarPoints), (SCREEN_W * 3) / 4, 28);
      g.textAlign = 'start';

      fill(g, '#5b8def', YOU_X, Math.round(you), PADDLE_W, PADDLE_H);
      fill(g, '#c4ecff', YOU_X, Math.round(you), 1, PADDLE_H);
      fill(g, '#d64545', OMAR_X, Math.round(omar), PADDLE_W, PADDLE_H);
      fill(g, '#ff8f8f', OMAR_X + PADDLE_W - 1, Math.round(omar), 1, PADDLE_H);
      if (serveIn <= 0) {
        fill(g, 'rgba(0,0,0,.25)', Math.round(ball.x) + 1, Math.round(ball.y) + 2, BALL, BALL);
        fill(g, '#ffffff', Math.round(ball.x), Math.round(ball.y), BALL, BALL);
      }
    },
  };
  return game;
}
