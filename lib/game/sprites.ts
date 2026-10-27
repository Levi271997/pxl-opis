// Pixel-art characters drawn in code. Each look gets a 16x22 sprite for every
// direction and walk frame, drawn once and cached.

import type { Dir, Look } from '../data';
import { rect } from './map';

export const SPRITE_W = 16;
export const SPRITE_H = 22;
const SPRITE_TOP = 2; // headroom for buns and spiky hair
const OUTLINE = '#1c1726';

export type Sprites = Record<Dir, HTMLCanvasElement[]>;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}

// frame 0 = standing, 1/2 = alternate steps
function drawCharacter(look: Look, dir: Exclude<Dir, 'right'>, frame: number) {
  const c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const g = c.getContext('2d')!;
  g.translate(0, SPRITE_TOP);

  const { skin, hair, shirt, pants, hairStyle } = look;
  const side = dir === 'left';
  const shoes = '#2a2230';
  const parts: { x: number; y: number; w: number; h: number; color: string; outline: boolean }[] = [];
  const add = (x: number, y: number, w: number, h: number, color: string, outline = true) =>
    parts.push({ x, y, w, h, color, outline });

  // legs
  if (side) {
    const [front, back] = frame === 0 ? [6, 8] : frame === 1 ? [5, 9] : [7, 7];
    add(back, 14, 2, 3, shade(pants, -0.3)); add(back, 17, 2, 1, shoes);
    add(front, 14, 2, 3, pants); add(front, 17, 2, 1, shoes);
  } else {
    const liftL = frame === 1 ? 1 : 0, liftR = frame === 2 ? 1 : 0;
    add(5, 14, 2, 3 - liftL, pants); add(5, 17 - liftL, 2, 1, shoes);
    add(9, 14, 2, 3 - liftR, pants); add(9, 17 - liftR, 2, 1, shoes);
  }

  // body + arms
  if (side) {
    add(5, 9, 6, 5, shirt);
    add(5, 13, 6, 1, shade(shirt, -0.2), false);
    const ax = frame === 1 ? 6 : frame === 2 ? 8 : 7;
    add(ax, 10, 2, 3, shade(shirt, -0.12));
    add(ax, 13, 2, 1, skin);
  } else {
    add(4, 9, 8, 5, shirt);
    add(4, 13, 8, 1, shade(shirt, -0.2), false);
    const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    add(3, 10 + sw, 1, 3, shirt); add(3, 13 + sw, 1, 1, skin);
    add(12, 10 - sw, 1, 3, shirt); add(12, 13 - sw, 1, 1, skin);
  }

  // head + hair
  add(4, 2, 8, 7, skin);
  if (dir === 'up') {
    add(4, 1, 8, 7, hair);
    if (hairStyle === 'long') add(4, 8, 8, 3, hair);
  } else if (side) {
    add(4, 1, 8, 3, hair);
    add(8, 3, 4, 4, hair);
    if (hairStyle === 'long') add(9, 6, 3, 5, hair);
  } else {
    add(4, 1, 8, 3, hair);
    add(4, 4, 1, 2, hair);
    add(11, 4, 1, 2, hair);
    if (hairStyle === 'long') { add(3, 3, 1, 7, hair); add(12, 3, 1, 7, hair); }
  }
  if (hairStyle === 'bun') add(side ? 8 : 6, -1, 4, 2, hair);
  if (hairStyle === 'spiky') { add(5, 0, 1, 1, hair); add(7, 0, 2, 1, hair); add(10, 0, 1, 1, hair); }

  // eyes
  const eye = '#1d1d27';
  if (dir === 'down') { add(6, 5, 1, 2, eye, false); add(9, 5, 1, 2, eye, false); }
  else if (side) add(5, 5, 1, 2, eye, false);

  // soft shadow, then outline pass, then colour pass
  rect(g, 'rgba(0,0,0,.22)', 3, 18, 10, 1);
  rect(g, 'rgba(0,0,0,.22)', 4, 19, 8, 1);
  g.fillStyle = OUTLINE;
  for (const p of parts) if (p.outline) g.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
  for (const p of parts) rect(g, p.color, p.x, p.y, p.w, p.h);
  return c;
}

function mirror(src: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

function buildSprites(look: Look): Sprites {
  const frames = (dir: Exclude<Dir, 'right'>) => [0, 1, 2].map(f => drawCharacter(look, dir, f));
  const left = frames('left');
  return { down: frames('down'), up: frames('up'), left, right: left.map(mirror) };
}

const cache = new Map<string, Sprites>();

export function spritesFor(look: Look): Sprites {
  const key = JSON.stringify(look);
  let s = cache.get(key);
  if (!s) cache.set(key, (s = buildSprites(look)));
  return s;
}

// Head-and-shoulders crop, used in the HUD, cards and team list.
export function drawPortrait(canvas: HTMLCanvasElement, sprites: Sprites) {
  canvas.width = 16;
  canvas.height = 16;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, 16, 16);
  g.drawImage(sprites.down[0], 0, 0, 16, 16, 0, 0, 16, 16);
}
