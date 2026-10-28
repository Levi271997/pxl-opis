// Turbo Lane: a top-down racer. Weave through traffic, grab coffee for bonus
// points, and try not to crash: three crashes and you're out.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const ROAD_X = 28;
const ROAD_W = 104;
const LANES = 3;
const LANE_W = ROAD_W / LANES;
const CAR_W = 12;
const CAR_H = 18;
const PLAYER_Y = SCREEN_H - CAR_H - 8;
const TRAFFIC_COLORS = ['#5b8def', '#f2a33a', '#8e6bd8', '#efe6d6', '#5fcf5a'];

interface Car { x: number; y: number; speed: number; color: string }
interface Cup { x: number; y: number }

const laneX = (lane: number) => ROAD_X + lane * LANE_W + (LANE_W - CAR_W) / 2;
const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

function drawCar(g: CanvasRenderingContext2D, x: number, y: number, color: string, facingUp: boolean) {
  x = Math.round(x);
  y = Math.round(y);
  fill(g, 'rgba(0,0,0,.3)', x + 1, y + 2, CAR_W, CAR_H);
  fill(g, '#1b1730', x - 1, y + 3, 2, 4); // wheels
  fill(g, '#1b1730', x + CAR_W - 1, y + 3, 2, 4);
  fill(g, '#1b1730', x - 1, y + CAR_H - 7, 2, 4);
  fill(g, '#1b1730', x + CAR_W - 1, y + CAR_H - 7, 2, 4);
  fill(g, color, x, y, CAR_W, CAR_H);
  fill(g, 'rgba(255,255,255,.3)', x + 1, y + 1, 1, CAR_H - 2);
  const front = facingUp ? y + 3 : y + CAR_H - 7;
  const back = facingUp ? y + CAR_H - 5 : y + 2;
  fill(g, '#9fd8ff', x + 2, front, CAR_W - 4, 4); // windscreen
  fill(g, '#5b7f99', x + 2, back, CAR_W - 4, 3); // rear window
  if (facingUp) {
    fill(g, '#ffe58a', x + 1, y, 2, 1); // headlights
    fill(g, '#ffe58a', x + CAR_W - 3, y, 2, 1);
  } else {
    fill(g, '#ff5d6c', x + 1, y + CAR_H - 1, 2, 1); // tail lights
    fill(g, '#ff5d6c', x + CAR_W - 3, y + CAR_H - 1, 2, 1);
  }
}

export function createRace(): Game {
  let x = laneX(1);
  let speed = 70; // pixels per second the road scrolls
  let distance = 0;
  let bonus = 0;
  let lives = 3;
  let hurt = 0; // seconds of blinking after a crash, when you can't crash again
  let scroll = 0;
  let spawnIn = 1;
  let cupIn = 3;
  const traffic: Car[] = [];
  const cups: Cup[] = [];

  // Top speed rises the further you get.
  const maxSpeed = () => Math.min(200, 110 + distance / 60);

  function spawnCar() {
    // Never block all lanes at once: skip lanes with a car near the top.
    const busy = new Set(traffic.filter(c => c.y < 40).map(c => Math.round((c.x - ROAD_X) / LANE_W - 0.3)));
    const free = [0, 1, 2].filter(l => !busy.has(l));
    if (free.length <= 1) return;
    const lane = free[Math.floor(Math.random() * free.length)];
    traffic.push({
      x: laneX(lane), y: -CAR_H - 4,
      speed: 25 + Math.random() * 35,
      color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
    });
  }

  const game: Game = {
    score: 0,
    over: false,
    update(dt, input) {
      const top = maxSpeed();
      if (input.held.up) speed += 80 * dt;
      else if (input.held.down) speed -= 120 * dt;
      else speed += (Math.min(top, 90 + distance / 80) - speed) * dt; // drift toward cruising speed
      speed = Math.max(45, Math.min(top, speed));

      if (input.held.left) x -= 80 * dt;
      if (input.held.right) x += 80 * dt;
      x = Math.max(ROAD_X + 1, Math.min(ROAD_X + ROAD_W - CAR_W - 1, x));

      distance += speed * dt;
      scroll = (scroll + speed * dt) % 16;
      hurt = Math.max(0, hurt - dt);

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnCar();
        spawnIn = Math.max(0.45, 1.3 - distance / 4000) * (0.7 + Math.random() * 0.6);
      }
      cupIn -= dt;
      if (cupIn <= 0) {
        cups.push({ x: laneX(Math.floor(Math.random() * LANES)) + 2, y: -10 });
        cupIn = 2.5 + Math.random() * 3;
      }

      for (const c of traffic) c.y += (speed - c.speed) * dt;
      for (const c of cups) c.y += speed * dt;

      for (let i = traffic.length - 1; i >= 0; i--) {
        const c = traffic[i];
        if (c.y > SCREEN_H + 4 || c.y < -60) traffic.splice(i, 1);
        else if (!hurt && overlaps(x + 1, PLAYER_Y + 1, CAR_W - 2, CAR_H - 2, c.x + 1, c.y + 1, CAR_W - 2, CAR_H - 2)) {
          lives--;
          hurt = 1.5;
          speed = 45;
          traffic.splice(i, 1);
          if (!lives) game.over = true;
        }
      }
      for (let i = cups.length - 1; i >= 0; i--) {
        const c = cups[i];
        if (c.y > SCREEN_H) cups.splice(i, 1);
        else if (overlaps(x, PLAYER_Y, CAR_W, CAR_H, c.x, c.y, 8, 8)) {
          bonus += 50;
          cups.splice(i, 1);
        }
      }

      game.score = Math.floor(distance / 10) + bonus;
      game.info = `Lives ${lives} · Speed ${Math.round(speed)}`;
    },
    draw(g) {
      // Grass with scrolling stripes.
      fill(g, '#3f8f4a', 0, 0, SCREEN_W, SCREEN_H);
      g.fillStyle = '#378043';
      for (let y = -16 + scroll; y < SCREEN_H; y += 16) {
        g.fillRect(0, y, ROAD_X - 4, 8);
        g.fillRect(ROAD_X + ROAD_W + 4, y, SCREEN_W - ROAD_X - ROAD_W - 4, 8);
      }
      // Kerbs, road and lane markings.
      for (let y = -16 + scroll; y < SCREEN_H; y += 16) {
        fill(g, '#d64545', ROAD_X - 4, y, 4, 8);
        fill(g, '#efe6d6', ROAD_X - 4, y + 8, 4, 8);
        fill(g, '#d64545', ROAD_X + ROAD_W, y, 4, 8);
        fill(g, '#efe6d6', ROAD_X + ROAD_W, y + 8, 4, 8);
      }
      fill(g, '#4a4658', ROAD_X, 0, ROAD_W, SCREEN_H);
      for (let l = 1; l < LANES; l++) {
        for (let y = -16 + scroll; y < SCREEN_H; y += 16) fill(g, '#cfc8b8', Math.round(ROAD_X + l * LANE_W) - 1, y, 2, 8);
      }

      for (const c of cups) {
        const cx = Math.round(c.x), cy = Math.round(c.y);
        fill(g, '#efe6d6', cx, cy + 2, 7, 6);
        fill(g, '#6b3f22', cx + 1, cy + 2, 5, 2);
        fill(g, '#efe6d6', cx + 7, cy + 3, 1, 3);
        fill(g, 'rgba(255,255,255,.6)', cx + 2, cy, 1, 1);
        fill(g, 'rgba(255,255,255,.6)', cx + 4, cy - 1, 1, 1);
      }
      for (const c of traffic) drawCar(g, c.x, c.y, c.color, false);
      if (!hurt || Math.floor(hurt * 10) % 2 === 0) drawCar(g, x, PLAYER_Y, '#d64545', true);
    },
  };
  return game;
}
