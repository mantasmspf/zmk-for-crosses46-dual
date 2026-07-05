// Level geometry is built from rectangle helpers (rather than hand-typed
// ASCII grids) so tile columns can never drift out of alignment.
const TILE = 16;

const T_EMPTY = 0;
const T_SOLID = 1;   // primary platform tile
const T_SOLID_ALT = 2; // secondary palette platform tile (checkpoints/exit area)
const T_SPIKE = 3;   // hazard, deadly on touch

function makeGrid(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) rows.push(new Array(w).fill(T_EMPTY));
  return rows;
}

function rect(grid, x0, y0, x1, y1, tile) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = tile;
    }
  }
}

function buildLevel(def) {
  const { width, height } = def;
  const grid = makeGrid(width, height);
  def.floor.forEach(([x0, x1, y, tile]) => rect(grid, x0, y, x1, height - 1, tile ?? T_SOLID));
  (def.platforms || []).forEach(([x0, x1, y, tile]) => rect(grid, x0, y, x1, y, tile ?? T_SOLID));
  (def.spikes || []).forEach(([x0, x1, y]) => rect(grid, x0, y, x1, y, T_SPIKE));
  return {
    id: def.id,
    name: def.name,
    subtitle: def.subtitle,
    width, height,
    tile: TILE,
    grid,
    spawn: def.spawn,
    exit: def.exit,
    checkpoints: def.checkpoints || [],
    shards: def.shards || [],
    enemies: def.enemies || [],
    lights: def.lights || [],
    bgTint: def.bgTint || "#1a1230",
    musicTrack: def.musicTrack ?? 0,
  };
}

const LEVELS_RAW = [
  {
    id: 1,
    name: "SECTOR 01",
    subtitle: "Neon Alley",
    width: 64,
    height: 17,
    bgTint: "#1a1230",
    musicTrack: 0,
    floor: [
      [0, 14, 16],
      [17, 27, 16],
      [30, 42, 16],
      [45, 63, 16],
    ],
    platforms: [
      [6, 9, 12],
      [19, 22, 11],
      [33, 36, 12],
      [38, 40, 9],
      [48, 52, 12],
      [55, 58, 9],
    ],
    spikes: [
      [20, 20, 15],
      [50, 51, 15],
    ],
    spawn: { x: 2 * TILE, y: 14 * TILE },
    exit: { x: 61 * TILE, y: 14 * TILE },
    checkpoints: [{ x: 31 * TILE, y: 14 * TILE }],
    shards: [
      [7, 11], [20, 10], [34, 11], [39, 8], [49, 11], [56, 8], [60, 14],
    ],
    enemies: [
      { x: 20 * TILE, y: 15 * TILE, range: 4 * TILE },
      { x: 50 * TILE, y: 15 * TILE, range: 3 * TILE },
    ],
    lights: [
      { x: 8 * TILE, y: 16 * TILE, color: "#57fff0", r: 90 },
      { x: 35 * TILE, y: 16 * TILE, color: "#ff2ec8", r: 90 },
      { x: 57 * TILE, y: 16 * TILE, color: "#57fff0", r: 90 },
    ],
  },
  {
    id: 2,
    name: "SECTOR 02",
    subtitle: "Data Yards",
    width: 72,
    height: 17,
    bgTint: "#160c26",
    musicTrack: 1,
    floor: [
      [0, 10, 16],
      [14, 20, 16],
      [24, 28, 16],
      [32, 40, 16],
      [44, 50, 16],
      [54, 71, 16],
    ],
    platforms: [
      [5, 8, 12],
      [16, 18, 10],
      [21, 23, 13],
      [26, 27, 9],
      [34, 38, 12],
      [42, 44, 8],
      [46, 49, 12],
      [58, 61, 11],
      [64, 67, 8],
    ],
    spikes: [
      [15, 16, 15],
      [25, 26, 15],
      [45, 46, 15],
      [59, 60, 15],
    ],
    spawn: { x: 2 * TILE, y: 14 * TILE },
    exit: { x: 69 * TILE, y: 14 * TILE },
    checkpoints: [{ x: 36 * TILE, y: 11 * TILE }],
    shards: [
      [6, 11], [17, 9], [22, 12], [26, 8], [35, 11], [43, 7], [47, 11], [59, 10], [65, 7],
    ],
    enemies: [
      { x: 17 * TILE, y: 9 * TILE, range: 3 * TILE },
      { x: 35 * TILE, y: 15 * TILE, range: 4 * TILE },
      { x: 59 * TILE, y: 10 * TILE, range: 3 * TILE },
      { x: 65 * TILE, y: 15 * TILE, range: 5 * TILE },
    ],
    lights: [
      { x: 6 * TILE, y: 16 * TILE, color: "#ff2ec8", r: 100 },
      { x: 36 * TILE, y: 16 * TILE, color: "#57fff0", r: 100 },
      { x: 60 * TILE, y: 16 * TILE, color: "#ff2ec8", r: 100 },
      { x: 68 * TILE, y: 16 * TILE, color: "#57fff0", r: 110 },
    ],
  },
  {
    id: 3,
    name: "SECTOR 03",
    subtitle: "The Core",
    width: 80,
    height: 17,
    bgTint: "#100a1e",
    musicTrack: 2,
    floor: [
      [0, 9, 16],
      [13, 17, 16],
      [21, 24, 16],
      [28, 33, 16],
      [37, 40, 16],
      [44, 49, 16],
      [53, 56, 16],
      [60, 79, 16],
    ],
    platforms: [
      [4, 7, 12],
      [14, 16, 10],
      [22, 23, 9],
      [29, 32, 12],
      [35, 36, 8],
      [38, 39, 12],
      [45, 48, 9],
      [51, 52, 12],
      [54, 55, 8],
      [62, 66, 12],
      [68, 70, 9],
      [73, 76, 12],
    ],
    spikes: [
      [10, 12, 15],
      [18, 20, 15],
      [25, 27, 15],
      [34, 34, 15],
      [41, 43, 15],
      [50, 50, 15],
      [57, 59, 15],
      [71, 72, 15],
    ],
    spawn: { x: 2 * TILE, y: 14 * TILE },
    exit: { x: 77 * TILE, y: 11 * TILE },
    checkpoints: [
      { x: 30 * TILE, y: 11 * TILE },
      { x: 63 * TILE, y: 11 * TILE },
    ],
    shards: [
      [5, 11], [15, 9], [22, 8], [30, 11], [35, 7], [45, 8], [51, 11],
      [54, 7], [63, 11], [69, 8], [74, 11],
    ],
    enemies: [
      { x: 15 * TILE, y: 9 * TILE, range: 2 * TILE },
      { x: 30 * TILE, y: 15 * TILE, range: 3 * TILE },
      { x: 46 * TILE, y: 8 * TILE, range: 3 * TILE },
      { x: 54 * TILE, y: 15 * TILE, range: 2 * TILE },
      { x: 63 * TILE, y: 11 * TILE, range: 3 * TILE },
      { x: 74 * TILE, y: 11 * TILE, range: 2 * TILE },
    ],
    lights: [
      { x: 5 * TILE, y: 16 * TILE, color: "#57fff0", r: 100 },
      { x: 30 * TILE, y: 16 * TILE, color: "#ff2ec8", r: 100 },
      { x: 54 * TILE, y: 16 * TILE, color: "#57fff0", r: 100 },
      { x: 63 * TILE, y: 16 * TILE, color: "#ff2ec8", r: 110 },
      { x: 77 * TILE, y: 11 * TILE, color: "#ffe23c", r: 140 },
    ],
  },
];

const LEVELS = LEVELS_RAW.map(buildLevel);
