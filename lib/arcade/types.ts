// Shared shapes for the arcade mini-games. Each game draws onto a small
// Game Boy sized screen; ArcadeScreen scales it up and runs the loop.

export const SCREEN_W = 160;
export const SCREEN_H = 144;

export type Button = 'left' | 'right' | 'up' | 'down' | 'action';

export interface Input {
  held: Record<Button, boolean>;
  pressed: Set<Button>; // went down since the last frame
}

export interface Game {
  score: number;
  over: boolean;
  info?: string; // extra line under the score, e.g. "Lives 2"
  update(dt: number, input: Input): void;
  draw(g: CanvasRenderingContext2D): void;
  click?(x: number, y: number): void; // a click or tap on the screen, in game pixels
}

export type GameId = 'snake' | 'breakout' | 'blocks' | 'race' | 'invaders' | 'whack';

export interface GameDef {
  id: GameId;
  title: string;
  blurb: string;
  controls: string;
  color: string;
  create(): Game;
}

export function fill(g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}
