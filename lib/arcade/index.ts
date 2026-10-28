import { createBlocks } from './blocks';
import { createBreakout } from './breakout';
import { createSnake } from './snake';
import type { GameDef, GameId } from './types';

export const GAMES: GameDef[] = [
  {
    id: 'snake', title: 'Snake', color: '#5fcf5a', create: createSnake,
    blurb: 'Collect coffee beans. Every bean makes you longer and faster.',
    controls: 'Arrows / WASD to turn',
  },
  {
    id: 'breakout', title: 'Breakout', color: '#5b8def', create: createBreakout,
    blurb: 'Smash every brick. Where the ball hits the paddle sets its angle.',
    controls: 'Left / right to move · Space to launch',
  },
  {
    id: 'blocks', title: 'Block Drop', color: '#f2a33a', create: createBlocks,
    blurb: 'Stack the falling pieces and clear full rows. Clear 4 at once for big points.',
    controls: 'Left / right to move · Up to rotate · Down to drop faster · Space to slam',
  },
];

export const gameById = (id: GameId) => GAMES.find(g => g.id === id)!;
