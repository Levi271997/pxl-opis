import { createBlocks } from './blocks';
import { createBreakout } from './breakout';
import { createInvaders } from './invaders';
import { createRace } from './race';
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
  {
    id: 'race', title: 'Turbo Lane', color: '#d64545', create: createRace,
    blurb: 'Weave through traffic and grab coffee for bonus points. Three crashes and you are out.',
    controls: 'Left / right to steer · Up to speed up · Down to brake',
  },
  {
    id: 'invaders', title: 'Inbox Invaders', color: '#d4508a', create: createInvaders,
    blurb: 'Emails march toward your desk. Spam is worth more, urgent mail takes two hits. Reach inbox zero!',
    controls: 'Left / right to move · Space to fire · Hide behind the boxes',
  },
];

export const gameById = (id: GameId) => GAMES.find(g => g.id === id)!;
