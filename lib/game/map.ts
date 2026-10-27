// Office map + tile art. Every tile is painted in code at 16x16, so there are
// no image files. Later: swap for a Tiled map + tileset.

export const TILE = 16;

// Legend:  # wall   . wood floor   , carpet   _ kitchen tile   r rug
//          d desk   p plant   b bookshelf   W whiteboard (opens the board)
//          t meeting table   k counter   K coffee machine   f fridge
//          s sofa   N notice board   U team status board   C water cooler
//          o dining floor   g dining table   h chair
const MAP_ROWS = [
  '#####################################################',
  '#,,W,,,,,,,,,#kkKkk__f__C_#poooooooooCp#bb.....pp...#',
  '#,,,,,,,,,,,,#____________#ohhhoooohhho#............#',
  '#,,tttttttt,,#__ss____ss__#ogggoooogggo#...dd.......#',
  '#,,tttttttt,,#____________oohhhoooohhho#...........p#',
  '#,,,,,,,,,,,,#__ss____ss__oohhhoooohhho#............#',
  '#p,,,,,,,,,,p#____________#ogggoooogggo#p...........#',
  '#,,,,,,,,,,,,#__p_________#ohhhoooohhho#............#',
  '######..##########....##########..###########..######',
  '#p........N.............U..................C.......p#',
  '#...................................................#',
  '#..dddd...dddd...rrrrrrr...dddd...dddd...dddd.......#',
  '#................rrrrrrr............................#',
  '#................rrrrrrr............................#',
  '#...................................................#',
  '#..dddd...dddd.............dddd...dddd...dddd.......#',
  '#...................................................#',
  '#...................................................#',
  '#.ss.ss..p.....................p..bbbb......p..ss.ss#',
  '#...................................................#',
  '#####################################################',
];
export const MAP_W = MAP_ROWS[0].length;
export const MAP_H = MAP_ROWS.length;
const SOLID = new Set('#dpbWtkKfsNUChg');
const FLOORS = '.,_ro';

const ZONES = [
  { name: 'Meeting Room', x1: 1, y1: 1, x2: 12, y2: 7 },
  { name: 'Kitchen', x1: 14, y1: 1, x2: 25, y2: 7 },
  { name: 'Dining Room', x1: 27, y1: 1, x2: 38, y2: 7 },
  { name: "Omar's Office", x1: 40, y1: 1, x2: 51, y2: 7 },
  { name: 'Open Office', x1: 1, y1: 9, x2: 51, y2: 19 },
];

export function tileAt(x: number, y: number) {
  if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) return '#';
  return MAP_ROWS[y][x] || '#';
}
export function isSolid(x: number, y: number) { return SOLID.has(tileAt(x, y)); }
export function zoneAt(x: number, y: number) {
  const z = ZONES.find(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2);
  return z ? z.name : null;
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Furniture sits on whatever floor is next to it.
function baseFloor(x: number, y: number) {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2]]) {
    const t = tileAt(x + dx, y + dy);
    if (FLOORS.includes(t) && t !== 'r') return t;
  }
  return '.';
}

type G = CanvasRenderingContext2D;

export function rect(g: G, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function paintFloor(g: G, t: string, x: number, y: number) {
  if (t === ',') {
    rect(g, '#4e5db3', 0, 0, 16, 16);
    g.fillStyle = '#5a6ac4';
    for (let j = 0; j < 16; j += 4) for (let i = ((j / 4) % 2) * 2; i < 16; i += 4) g.fillRect(i, j, 1, 1);
  } else if (t === '_') {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      rect(g, (x * 2 + i + y * 2 + j) % 2 ? '#dde1e6' : '#f0f2f4', i * 8, j * 8, 8, 8);
    }
  } else if (t === 'o') {
    // warm terracotta tiles for the dining room
    rect(g, '#d9a273', 0, 0, 16, 16);
    rect(g, (x + y) % 2 ? '#cf9466' : '#e0ad80', 1, 1, 6, 6);
    rect(g, (x + y) % 2 ? '#e0ad80' : '#cf9466', 9, 9, 6, 6);
    g.fillStyle = '#b97f55';
    g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1);
    g.fillRect(7, 0, 1, 16); g.fillRect(15, 0, 1, 16);
  } else if (t === 'r') {
    rect(g, '#a33f3c', 0, 0, 16, 16);
    rect(g, '#b9554c', 5, 5, 6, 6);
    rect(g, '#d9b45a', 7, 4, 2, 8);
    rect(g, '#d9b45a', 4, 7, 8, 2);
    g.fillStyle = '#d9b45a';
    if (tileAt(x, y - 1) !== 'r') g.fillRect(0, 1, 16, 1);
    if (tileAt(x, y + 1) !== 'r') g.fillRect(0, 14, 16, 1);
    if (tileAt(x - 1, y) !== 'r') g.fillRect(1, 0, 1, 16);
    if (tileAt(x + 1, y) !== 'r') g.fillRect(14, 0, 1, 16);
  } else {
    rect(g, '#c79f74', 0, 0, 16, 16);
    g.fillStyle = '#b38a60';
    for (let i = 0; i < 4; i++) {
      g.fillRect(0, i * 4 + 3, 16, 1);
      g.fillRect(hash(x, y * 4 + i) % 16, i * 4, 1, 3);
    }
    const h = hash(x, y);
    rect(g, '#d2ad84', h % 14, ((h >> 4) % 4) * 4 + 1, 2, 1);
  }
}

function paintWall(g: G, x: number, y: number) {
  const faceVisible = y + 1 < MAP_H && tileAt(x, y + 1) !== '#';
  if (!faceVisible) {
    rect(g, '#3a3450', 0, 0, 16, 16);
    rect(g, '#463f5f', 0, 0, 16, 1);
    return;
  }
  rect(g, '#3a3450', 0, 0, 16, 4);
  rect(g, '#efe6d6', 0, 4, 16, 10);
  rect(g, '#e0d5c1', 0, 9, 16, 1);
  rect(g, '#7b6a58', 0, 14, 16, 2);
  if (y === 0 && hash(x, y) % 3 === 0) {
    rect(g, '#5b5470', 2, 5, 12, 8);
    rect(g, '#8fd3ff', 3, 6, 10, 6);
    rect(g, '#c4ecff', 4, 7, 3, 2);
    rect(g, '#5b5470', 7, 6, 2, 6);
  }
}

const PAINTERS: Record<string, (g: G, x: number, y: number) => void> = {
  d(g, x, y) {
    rect(g, 'rgba(0,0,0,.18)', 0, 14, 16, 2);
    rect(g, '#6e4322', 0, 5, 16, 9);
    rect(g, '#9a6234', 0, 5, 16, 6);
    rect(g, '#b07442', 0, 5, 16, 1);
    rect(g, '#4e2f17', 0, 13, 16, 1);
    if (tileAt(x - 1, y) !== 'd') rect(g, '#4e2f17', 0, 5, 1, 9);
    if (tileAt(x + 1, y) !== 'd') rect(g, '#4e2f17', 15, 5, 1, 9);
    // monitor, seen from behind (the person sits on the other side)
    rect(g, '#2a2d38', 3, 0, 10, 6);
    rect(g, '#3d4252', 4, 1, 8, 4);
    rect(g, '#6fd3ff', 3, 0, 10, 1);
    rect(g, '#2a2d38', 7, 6, 2, 2);
    if (hash(x, y) % 3 === 0) { rect(g, '#f4f4f4', 12, 8, 3, 3); rect(g, '#d64545', 12, 8, 3, 1); }
    else rect(g, '#f6f1e1', 1, 7, 4, 3);
  },
  p(g) {
    rect(g, 'rgba(0,0,0,.2)', 3, 14, 10, 2);
    rect(g, '#a85a34', 5, 11, 6, 4);
    rect(g, '#c8744a', 4, 9, 8, 2);
    rect(g, '#2f8a4c', 3, 3, 10, 6);
    rect(g, '#2f8a4c', 5, 1, 6, 2);
    rect(g, '#2f8a4c', 2, 5, 12, 3);
    rect(g, '#47b468', 5, 3, 3, 2);
    rect(g, '#47b468', 9, 2, 2, 2);
    rect(g, '#47b468', 4, 6, 2, 1);
    rect(g, '#47b468', 10, 5, 2, 2);
  },
  b(g, x, y) {
    rect(g, '#5b3a1f', 0, 0, 16, 15);
    rect(g, 'rgba(0,0,0,.2)', 0, 15, 16, 1);
    const colors = ['#d64545', '#5b8def', '#f2a33a', '#46b5a6', '#8e6bd8', '#e0679b', '#f4f4f4'];
    let h = hash(x, y);
    for (const [sy, sh] of [[1, 4], [6, 4], [11, 3]]) {
      rect(g, '#3b2412', 1, sy, 14, sh);
      let bx = 1;
      while (bx < 15) {
        h = (Math.imul(h, 1103515245) + 12345) >>> 0;
        const w = 1 + ((h >> 8) % 2);
        if (bx + w > 15) break;
        const bh = sh - ((h >> 12) % 2);
        rect(g, colors[(h >> 16) % colors.length], bx, sy + sh - bh, w, bh);
        bx += w + ((h >> 20) % 4 === 0 ? 1 : 0);
      }
    }
  },
  W(g) {
    rect(g, '#6b7280', 3, 11, 1, 5);
    rect(g, '#6b7280', 12, 11, 1, 5);
    rect(g, '#9aa3ad', 0, 0, 16, 12);
    rect(g, '#fbfbf7', 1, 1, 14, 10);
    rect(g, '#c9ced4', 5, 1, 1, 10);
    rect(g, '#c9ced4', 10, 1, 1, 10);
    rect(g, '#ffd84d', 2, 2, 2, 2);
    rect(g, '#ff8fa3', 2, 5, 2, 2);
    rect(g, '#7fd3ff', 7, 2, 2, 2);
    rect(g, '#ffd84d', 7, 6, 2, 2);
    rect(g, '#9be37a', 12, 2, 2, 2);
    rect(g, '#6b7280', 2, 11, 12, 1);
  },
  t(g, x, y) {
    const up = tileAt(x, y - 1) === 't', dn = tileAt(x, y + 1) === 't';
    const lf = tileAt(x - 1, y) === 't', rt = tileAt(x + 1, y) === 't';
    rect(g, '#a36d40', 0, 0, 16, 16);
    if (!up) rect(g, '#bd8452', 0, 0, 16, 1);
    if (!dn) { rect(g, '#6b4223', 0, 10, 16, 4); rect(g, 'rgba(0,0,0,.2)', 0, 14, 16, 2); }
    if (!lf) rect(g, '#6b4223', 0, 0, 1, dn ? 16 : 14);
    if (!rt) rect(g, '#6b4223', 15, 0, 1, dn ? 16 : 14);
    const h = hash(x, y) % 4;
    if (h === 0) rect(g, '#f6f1e1', 4, up ? 2 : 3, 5, 4);
    if (h === 1) { rect(g, '#9aa3ad', 5, 2, 6, 5); rect(g, '#c4ecff', 6, 3, 4, 3); }
  },
  k(g) {
    rect(g, '#c9ced4', 0, 0, 16, 9);
    rect(g, '#e3e7eb', 0, 0, 16, 1);
    rect(g, '#9097a0', 0, 9, 16, 7);
    rect(g, '#7a818a', 0, 9, 16, 1);
    rect(g, '#7a818a', 7, 10, 1, 6);
    rect(g, '#d7dbe0', 5, 12, 1, 2);
    rect(g, '#d7dbe0', 9, 12, 1, 2);
  },
  K(g, x, y) {
    PAINTERS.k(g, x, y);
    rect(g, '#2b2b33', 4, 0, 8, 8);
    rect(g, '#3e3e48', 5, 1, 6, 3);
    rect(g, '#ff4d4d', 10, 1, 1, 1);
    rect(g, '#1a1a20', 7, 4, 2, 1);
    rect(g, '#ffffff', 7, 6, 2, 2);
  },
  f(g) {
    rect(g, '#9fb0bc', 1, 0, 14, 16);
    rect(g, '#e8eef2', 2, 0, 12, 15);
    rect(g, '#b8c6cf', 2, 6, 12, 1);
    rect(g, '#8fa0ab', 11, 2, 1, 3);
    rect(g, '#8fa0ab', 11, 8, 1, 5);
  },
  s(g) {
    rect(g, 'rgba(0,0,0,.2)', 1, 14, 14, 2);
    rect(g, '#355a9e', 1, 3, 14, 6);
    rect(g, '#3f69b8', 1, 7, 14, 7);
    rect(g, '#5585d6', 3, 8, 4, 4);
    rect(g, '#5585d6', 9, 8, 4, 4);
    rect(g, '#2f518f', 0, 5, 2, 9);
    rect(g, '#2f518f', 14, 5, 2, 9);
  },
  N(g) {
    rect(g, '#5b3a1f', 3, 11, 1, 5);
    rect(g, '#5b3a1f', 12, 11, 1, 5);
    rect(g, '#7a5230', 0, 1, 16, 11);
    rect(g, '#c9955c', 1, 2, 14, 9);
    rect(g, '#fbfbf7', 2, 3, 4, 5);
    rect(g, '#ffe58a', 7, 3, 4, 3);
    rect(g, '#bfe3ff', 8, 7, 5, 3);
    rect(g, '#d64545', 3, 3, 1, 1);
    rect(g, '#d64545', 8, 3, 1, 1);
    rect(g, '#d64545', 10, 7, 1, 1);
  },
  // Water cooler: blue bottle on a white stand, with a cup dispenser.
  C(g) {
    rect(g, 'rgba(0,0,0,.2)', 3, 14, 10, 2);
    rect(g, '#c9d3db', 4, 6, 8, 9);
    rect(g, '#eef3f6', 5, 6, 6, 8);
    rect(g, '#d64545', 6, 9, 1, 1);
    rect(g, '#4f7fe0', 9, 9, 1, 1);
    rect(g, '#8fa0ab', 5, 12, 6, 1);
    rect(g, '#3d8fd6', 5, 0, 6, 6);
    rect(g, '#6fc3ff', 6, 1, 4, 4);
    rect(g, '#c4ecff', 6, 1, 1, 3);
    rect(g, '#2b6fb0', 7, 5, 2, 1);
    rect(g, '#f4f4f4', 12, 8, 2, 4);
  },
  // Dining table with a tablecloth; plates on each tile.
  g(g, x, y) {
    const lf = tileAt(x - 1, y) === 'g', rt = tileAt(x + 1, y) === 'g';
    rect(g, 'rgba(0,0,0,.2)', 0, 13, 16, 3);
    rect(g, '#7a4a28', 0, 2, 16, 11);
    rect(g, '#f6f1e1', 0, 2, 16, 8);
    rect(g, '#e6dcc4', 0, 9, 16, 2);
    if (!lf) rect(g, '#7a4a28', 0, 2, 1, 11);
    if (!rt) rect(g, '#7a4a28', 15, 2, 1, 11);
    rect(g, '#ffffff', 5, 3, 6, 4);
    rect(g, '#d9d4c7', 6, 4, 4, 2);
    if (hash(x, y) % 2) rect(g, '#e0679b', 7, 4, 2, 1);
    else rect(g, '#9be37a', 7, 4, 2, 1);
  },
  h(g, x, y) {
    // the chair back faces away from the table it belongs to
    const tableBelow = tileAt(x, y + 1) === 'g';
    rect(g, 'rgba(0,0,0,.18)', 4, 13, 8, 2);
    rect(g, '#8a5a33', 4, 5, 8, 7);
    rect(g, '#a36d40', 5, 6, 6, 5);
    rect(g, '#6b4223', 4, tableBelow ? 2 : 10, 8, 3);
    rect(g, '#6b4223', 4, 12, 1, 2);
    rect(g, '#6b4223', 11, 12, 1, 2);
  },
  // Team status board: a grid of little faces, each with a status light.
  U(g) {
    rect(g, '#5b3a1f', 3, 12, 1, 4);
    rect(g, '#5b3a1f', 12, 12, 1, 4);
    rect(g, '#2b2840', 0, 0, 16, 13);
    rect(g, '#3a3450', 1, 1, 14, 11);
    rect(g, '#ffd84d', 1, 1, 14, 2);
    const lights = ['#4ade80', '#4ade80', '#f87171', '#4ade80', '#facc15', '#4ade80'];
    lights.forEach((light, i) => {
      const x = 2 + (i % 3) * 4, y = 4 + Math.floor(i / 3) * 4;
      rect(g, '#e8b58a', x, y, 2, 2);
      rect(g, '#5a3825', x, y, 2, 1);
      rect(g, light, x + 2, y + 2, 1, 1);
    });
  },
};

// Paint the whole office once into an offscreen canvas.
export function renderMap() {
  const c = document.createElement('canvas');
  c.width = MAP_W * TILE;
  c.height = MAP_H * TILE;
  const g = c.getContext('2d')!;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = tileAt(x, y);
      g.save();
      g.translate(x * TILE, y * TILE);
      if (t === '#') paintWall(g, x, y);
      else if (FLOORS.includes(t)) paintFloor(g, t, x, y);
      else {
        paintFloor(g, baseFloor(x, y), x, y);
        PAINTERS[t]?.(g, x, y);
      }
      g.restore();
    }
  }
  return c;
}
