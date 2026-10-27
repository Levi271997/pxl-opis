// 12x12 pixel art for the food in the fridge. One character per pixel;
// '.' is transparent, every other character is a palette colour.

import type { FoodId } from '../data';

const PALETTE: Record<string, string> = {
  k: '#1c1726', // outline
  w: '#ffffff',
  g: '#c9ced4',
  r: '#d64545',
  R: '#a83232',
  y: '#f2c94c',
  Y: '#d9a62e',
  p: '#f7b2b2',
  f: '#fde8dc',
  s: '#8cc4e8',
  S: '#4f8ab0',
  o: '#f2a33a',
  m: '#5b8def',
};

const ART: Record<FoodId, string[]> = {
  noodles: [
    '............',
    '...y..y..y..',
    '..y..y..y...',
    '.kkkkkkkkkk.',
    '.kyYyyYyyYk.',
    '.kkkkkkkkkk.',
    '..kwwwwwwk..',
    '..krrrrrrk..',
    '..kwrwwrwk..',
    '..kwwwwwwk..',
    '...kwwwwk...',
    '...kkkkkk...',
  ],
  meat: [
    '............',
    '....kkkkk...',
    '...kfrrrrk..',
    '..kfrrprrrk.',
    '.kfrrrrrprk.',
    '.kfrprrrrrk.',
    '.kfrrrrrrRk.',
    '..kfrrrrRk..',
    '...kfRRRk...',
    '....kkkk....',
    '............',
    '............',
  ],
  fish: [
    '............',
    '............',
    '...kkkkk...k',
    '..ksssssk.kk',
    '.kswkssssksk',
    'kssssssssssk',
    'kSSSSSSSSkSk',
    '.kSSSSSSk.kk',
    '..kkkkkk...k',
    '............',
    '............',
    '............',
  ],
  eggs: [
    '............',
    '....kkkk....',
    '...kwwwwk...',
    '..kwwwwwwk..',
    '..kwwwwwwk..',
    '.kwwwwwwwwk.',
    '.kwwwwwwwgk.',
    '.kwwwwwwggk.',
    '..kwwwwggk..',
    '...kkkkkk...',
    '............',
    '............',
  ],
  milk: [
    '.....kk.....',
    '....kwwk....',
    '...kwwwwk...',
    '..kkkkkkkk..',
    '..kwwwwwwk..',
    '..kmmmmmmk..',
    '..kmwwwwmk..',
    '..kmmmmmmk..',
    '..kwwwwwwk..',
    '..kwwwwwwk..',
    '..kkkkkkkk..',
    '............',
  ],
  lunchbox: [
    '............',
    '....kkkk....',
    '....k..k....',
    '.kkkkkkkkkk.',
    '.kooooooook.',
    '.kowwwwwwok.',
    '.kowkkkwwok.',
    '.kowwwwwwok.',
    '.kooooooook.',
    '.kkkkkkkkkk.',
    '............',
    '............',
  ],
};

export function drawFood(canvas: HTMLCanvasElement, id: FoodId) {
  canvas.width = 12;
  canvas.height = 12;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, 12, 12);
  ART[id].forEach((row, y) => [...row].forEach((c, x) => {
    const color = PALETTE[c];
    if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
  }));
}
