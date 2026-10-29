import { createBlocks } from './blocks';
import { createBreakout } from './breakout';
import { createCrossing } from './crossing';
import { createInvaders } from './invaders';
import { createPlane } from './plane';
import { createPong } from './pong';
import { createRace } from './race';
import { createSnake } from './snake';
import { createWhack } from './whack';
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
  {
    id: 'whack', title: 'Whack-a-Bug', color: '#8e6bd8', create: createWhack,
    blurb: 'Squash bugs before they ship. Chain hits for a combo, and don\'t smash the features!',
    controls: 'Click a laptop, or arrows + Space to whack',
  },
  {
    id: 'plane', title: 'Paper Plane', color: '#4fb3ff', create: createPlane,
    blurb: 'Keep your paper plane in the air through the gaps between filing cabinets.',
    controls: 'Space, Up or click to flap',
  },
  {
    id: 'pong', title: 'Break Room Pong', color: '#2f7d5b', create: createPong,
    blurb: 'Table tennis against Omar. He gets quicker every 3 points. Long rallies score more.',
    controls: 'Up / down to move, or click where to go',
  },
  {
    id: 'crossing', title: 'Office Crossing', color: '#c99a5c', create: createCrossing,
    blurb: 'Carry a coffee to the team desk across aisles of rolling chairs, mail carts and robot vacuums.',
    controls: 'Arrows to hop, or click beside your character',
  },
];

export const gameById = (id: GameId) => GAMES.find(g => g.id === id)!;
