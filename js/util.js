'use strict';
/* Shared helpers and seed material. */
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const PPE = 2;   // pulses per eighth note: the pulse is a sixteenth, so In C's fast cells fit

function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash32(...xs){ let h = 2166136261 >>> 0; for (const x of xs){ h ^= x >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; } return h >>> 0; }

/* Original placeholder seeds, in scale degrees of C major (0 = C4). [onset, duration, degree] */
const DEFAULT_SEEDS = [
  {len:4, notes:[[0,1,4],[1,1,5],[2,2,4]]},
  {len:6, notes:[[0,2,2],[2,1,3],[3,1,4],[4,2,2]]},
  {len:3, notes:[[0,1,7],[1,2,4]]},
  {len:8, notes:[[0,4,6],[4,4,4]]},
  {len:8, notes:[[0,1,2],[1,1,4],[2,1,2],[3,1,4],[4,4,5]]},
  {len:2, notes:[[0,1,4],[1,1,3]]},
  {len:5, notes:[[1,1,5],[2,1,4],[3,2,2]]},
  {len:12, notes:[[0,6,0],[6,6,-1]]},
  {len:4, notes:[[0,1,9],[1,1,8],[2,1,7],[3,1,6]]},
  {len:6, notes:[[0,3,4],[3,3,5]]}
];
const CMAJ = [0,2,4,5,7,9,11];
const midiOfC = d => 60 + 12*Math.floor(d/7) + CMAJ[mod(d,7)];
const DEFAULT_SEEDS_JSON = JSON.stringify(DEFAULT_SEEDS.map(s => ({len:s.len, notes:s.notes.map(([o,d,g]) => [o,d,midiOfC(g)])})));

