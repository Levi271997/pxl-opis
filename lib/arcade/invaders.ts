// Inbox Invaders: waves of email march down the screen. Shoot them before they
// reach your desk. Spam is worth more, urgent mail takes two hits, and the odd
// newsletter flies across the top for bonus points.

import { fill, SCREEN_H, SCREEN_W, type Game } from './types';

const COLS = 8;
const ROWS = 5;
const MAIL_W = 10;
const MAIL_H = 7;
const GAP_X = 4;
const GAP_Y = 4;
const PLAYER_W = 13;
const PLAYER_Y = SCREEN_H - 12;
const BOX_Y = PLAYER_Y - 18;
const CELL = 2; // cardboard boxes are made of 2x2 chunks that get knocked out

type Kind = 'urgent' | 'spam' | 'mail';
const KINDS: Kind[] = ['urgent', 'spam', 'spam', 'mail', 'mail']; // per row, top to bottom
const POINTS: Record<Kind, number> = { urgent: 30, spam: 20, mail: 10 };
const COLORS: Record<Kind, { body: string; flap: string }> = {
  urgent: { body: '#ff8f8f', flap: '#d64545' },
  spam: { body: '#f7b6e0', flap: '#d4508a' },
  mail: { body: '#efe6d6', flap: '#b9ad97' },
};

interface Mail { col: number; row: number; kind: Kind; hp: number }
interface Shot { x: number; y: number }

export function createInvaders(): Game {
  let wave = 0;
  let lives = 3;
  let x = (SCREEN_W - PLAYER_W) / 2;
  let mail: Mail[] = [];
  let ox = 0, oy = 0; // where the whole inbox grid is
  let dir = 1;
  let stepTimer = 0;
  let frame = 0; // flips each step so the envelopes "flap"
  let shots: Shot[] = [];
  let clips: Shot[] = [];
  let cooldown = 0;
  let hurt = 0;
  let newsletter: { x: number; dir: number } | null = null;
  let newsletterIn = 12;
  let boxes = new Set<string>();

  function buildBoxes() {
    boxes = new Set();
    for (const bx of [28, 72, 116]) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) {
        if (j === 3 && (i === 3 || i === 4)) continue; // a notch underneath
        boxes.add(`${bx + i * CELL},${BOX_Y + j * CELL}`);
      }
    }
  }

  function nextWave() {
    wave++;
    mail = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      mail.push({ col: c, row: r, kind: KINDS[r], hp: KINDS[r] === 'urgent' ? 2 : 1 });
    }
    ox = 14;
    oy = 14 + Math.min(wave - 1, 4) * 4; // later waves start a little lower
    dir = 1;
    shots = [];
    clips = [];
    if (wave === 1) buildBoxes();
  }
  nextWave();

  const mailX = (m: Mail) => ox + m.col * (MAIL_W + GAP_X);
  const mailY = (m: Mail) => oy + m.row * (MAIL_H + GAP_Y);
  // Fewer emails left = the inbox moves faster.
  const stepTime = () => Math.max(0.05, (0.55 - wave * 0.03) * (mail.length / (COLS * ROWS)) + 0.04);

  function hitBox(sx: number, sy: number, h: number) {
    for (const key of boxes) {
      const [bx, by] = key.split(',').map(Number);
      if (sx + 1 >= bx && sx <= bx + CELL && sy + h >= by && sy <= by + CELL) {
        boxes.delete(key);
        return true;
      }
    }
    return false;
  }

  function stepInbox() {
    frame ^= 1;
    const xs = mail.map(mailX);
    const left = Math.min(...xs), right = Math.max(...xs) + MAIL_W;
    if ((dir > 0 && right + 3 > SCREEN_W - 2) || (dir < 0 && left - 3 < 2)) {
      dir = -dir;
      oy += 4;
    } else ox += dir * 3;

    // The lowest email in a random column sends a paperclip down.
    if (Math.random() < 0.35 + wave * 0.05 && clips.length < 2 + wave) {
      const cols = [...new Set(mail.map(m => m.col))];
      const col = cols[Math.floor(Math.random() * cols.length)];
      const shooter = mail.filter(m => m.col === col).sort((a, b) => b.row - a.row)[0];
      clips.push({ x: mailX(shooter) + MAIL_W / 2, y: mailY(shooter) + MAIL_H });
    }

    // Mail eats through boxes it touches, and reaching your desk ends the game.
    for (const m of mail) {
      const mx = mailX(m), my = mailY(m);
      for (const key of [...boxes]) {
        const [bx, by] = key.split(',').map(Number);
        if (bx + CELL > mx && bx < mx + MAIL_W && by + CELL > my && by < my + MAIL_H) boxes.delete(key);
      }
      if (my + MAIL_H >= PLAYER_Y) game.over = true;
    }
  }

  const game: Game = {
    score: 0,
    over: false,
    update(dt, input) {
      if (input.held.left) x -= 75 * dt;
      if (input.held.right) x += 75 * dt;
      x = Math.max(2, Math.min(SCREEN_W - PLAYER_W - 2, x));

      cooldown -= dt;
      hurt = Math.max(0, hurt - dt);
      if ((input.pressed.has('action') || input.pressed.has('up')) && cooldown <= 0 && shots.length < 2) {
        shots.push({ x: x + PLAYER_W / 2 - 0.5, y: PLAYER_Y - 4 });
        cooldown = 0.28;
      }

      stepTimer += dt;
      while (stepTimer >= stepTime() && !game.over) {
        stepTimer -= stepTime();
        stepInbox();
      }

      newsletterIn -= dt;
      if (!newsletter && newsletterIn <= 0) {
        const fromLeft = Math.random() < 0.5;
        newsletter = { x: fromLeft ? -16 : SCREEN_W, dir: fromLeft ? 1 : -1 };
      }
      if (newsletter) {
        newsletter.x += newsletter.dir * 40 * dt;
        if (newsletter.x < -20 || newsletter.x > SCREEN_W + 4) {
          newsletter = null;
          newsletterIn = 10 + Math.random() * 10;
        }
      }

      for (const s of shots) s.y -= 150 * dt;
      for (const c of clips) c.y += (55 + wave * 6) * dt;

      shots = shots.filter(s => {
        if (s.y < 6) return false;
        if (hitBox(s.x, s.y, 4)) return false;
        if (newsletter && s.x >= newsletter.x && s.x <= newsletter.x + 16 && s.y <= 10) {
          game.score += 100;
          newsletter = null;
          newsletterIn = 12 + Math.random() * 10;
          return false;
        }
        const hit = mail.find(m => s.x + 1 >= mailX(m) && s.x <= mailX(m) + MAIL_W && s.y <= mailY(m) + MAIL_H && s.y + 4 >= mailY(m));
        if (!hit) return true;
        if (--hit.hp <= 0) {
          mail.splice(mail.indexOf(hit), 1);
          game.score += POINTS[hit.kind];
        }
        return false;
      });

      clips = clips.filter(c => {
        if (c.y > SCREEN_H) return false;
        if (hitBox(c.x, c.y, 4)) return false;
        if (!hurt && c.x + 1 >= x && c.x <= x + PLAYER_W && c.y + 4 >= PLAYER_Y && c.y <= PLAYER_Y + 7) {
          lives--;
          hurt = 1.5;
          if (!lives) game.over = true;
          return false;
        }
        return true;
      });

      if (!mail.length && !game.over) {
        game.score += 50 * wave; // inbox zero bonus
        nextWave();
      }
      game.info = `Lives ${lives} · Wave ${wave} · ${mail.length} unread`;
    },
    draw(g) {
      fill(g, '#1b1730', 0, 0, SCREEN_W, SCREEN_H);
      g.fillStyle = '#2b2840';
      for (let i = 0; i < 18; i++) g.fillRect((i * 37) % SCREEN_W, (i * 53) % (SCREEN_H - 30), 1, 1); // dust in the air

      if (newsletter) {
        const nx = Math.round(newsletter.x);
        fill(g, '#ffd84d', nx, 3, 16, 7);
        fill(g, '#d9a441', nx, 3, 16, 1);
        fill(g, '#2b2840', nx + 3, 5, 10, 1);
        fill(g, '#2b2840', nx + 3, 7, 7, 1);
      }

      for (const m of mail) {
        const mx = Math.round(mailX(m)), my = Math.round(mailY(m));
        const c = COLORS[m.kind];
        fill(g, c.body, mx, my, MAIL_W, MAIL_H);
        // The flap opens and closes as the inbox steps.
        if (frame) {
          fill(g, c.flap, mx + 1, my + 1, 2, 1); fill(g, c.flap, mx + 3, my + 2, 2, 1);
          fill(g, c.flap, mx + 5, my + 2, 2, 1); fill(g, c.flap, mx + 7, my + 1, 2, 1);
        } else {
          fill(g, c.flap, mx + 1, my, 2, 1); fill(g, c.flap, mx + 3, my + 1, 4, 1); fill(g, c.flap, mx + 7, my, 2, 1);
        }
        if (m.kind === 'urgent') {
          fill(g, m.hp > 1 ? '#ffffff' : '#ffd84d', mx + 4, my + 3, 2, 2); // "!"
          fill(g, m.hp > 1 ? '#ffffff' : '#ffd84d', mx + 4, my + 6, 2, 1);
        }
        if (m.kind === 'spam') fill(g, '#d4508a', mx + 2, my + 4, 6, 1);
      }

      g.fillStyle = '#c99a5c';
      for (const key of boxes) {
        const [bx, by] = key.split(',').map(Number);
        g.fillRect(bx, by, CELL, CELL);
      }

      g.fillStyle = '#ffffff';
      for (const s of shots) g.fillRect(Math.round(s.x), Math.round(s.y), 1, 4);
      g.fillStyle = '#9aa3ad';
      for (const c of clips) {
        const cx = Math.round(c.x), cy = Math.round(c.y);
        g.fillRect(cx, cy, 1, 4); g.fillRect(cx + 1, cy, 1, 1); g.fillRect(cx + 1, cy + 3, 1, 1);
      }

      // Your laptop: lid, screen glow, keyboard base.
      if (!hurt || Math.floor(hurt * 10) % 2 === 0) {
        const px = Math.round(x);
        fill(g, '#9aa3ad', px + 2, PLAYER_Y, PLAYER_W - 4, 6);
        fill(g, '#5b8def', px + 3, PLAYER_Y + 1, PLAYER_W - 6, 4);
        fill(g, '#c4ecff', px + 4, PLAYER_Y + 2, 2, 1);
        fill(g, '#c9ced4', px, PLAYER_Y + 6, PLAYER_W, 2);
        fill(g, '#ffffff', px + PLAYER_W / 2 - 0.5, PLAYER_Y - 2, 1, 2);
      }
      fill(g, '#3a3450', 0, SCREEN_H - 3, SCREEN_W, 3);
    },
  };
  return game;
}
