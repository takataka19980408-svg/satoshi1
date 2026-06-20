export const CANVAS_W = 360;
export const CANVAS_H = 640;
export const TILE_SIZE = 32;

export const LAYOUT = {
  status: { x: 0, y: 0,   w: 360, h: 44  },
  game:   { x: 0, y: 44,  w: 360, h: 352 },
  msg:    { x: 0, y: 396, w: 360, h: 84  },
  ctrl:   { x: 0, y: 480, w: 360, h: 160 },
};

export const DPAD = {
  cx: 80, cy: 560,
  up:    { x: 80,  y: 508 },
  down:  { x: 80,  y: 612 },
  left:  { x: 28,  y: 560 },
  right: { x: 132, y: 560 },
  size: 38,
};

export const BTNS = {
  a:    { x: 302, y: 528, r: 28 },
  b:    { x: 255, y: 575, r: 22 },
  menu: { x: 185, y: 528, r: 18 },
};

export const COLORS = {
  bg:       '#0a0a1e',
  panel:    '#0e1030',
  border:   '#2a3a6a',
  text:     '#c8d8ff',
  textDim:  '#607098',
  accent:   '#7ab8ff',
  gold:     '#e0c060',
  hp:       '#44cc44',
  hpLow:    '#cc4444',
  mp:       '#4488ff',
  enemy:    '#cc4444',
};

export const TILE_COLORS = {
  0:  '#000000', // void
  1:  '#2d5a1b', // grass
  2:  '#7a5a18', // dirt path
  3:  '#1a3a8a', // water
  4:  '#1a3a0a', // tree
  5:  '#3a3040', // wall
  6:  '#5a3820', // wooden floor
  7:  '#3a3040', // wall top
  8:  '#152010', // forest floor (encounter)
  9:  '#2a2040', // stone floor
  10: '#334422', // tall grass
  11: '#2a2430', // fence
  12: '#3a3040', // well (impassable)
  13: '#5a3820', // door (passable)
};

export const TILE_PASSABLE = new Set([1, 2, 6, 8, 9, 10, 13]);
export const TILE_ENCOUNTER = new Set([8]);
