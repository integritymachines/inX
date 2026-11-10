'use strict';
/* Styles: one set of values per layer. The engine reads the current style through ST.
   Keys marked "structural" change what exists (roster, grid, tuning) and switch only at the next section;
   the rest take effect at once. */
const STYLES = {};
STYLES.inc = {
  label: 'In C',
  // time
  pulseMs: 200,
  // ensemble
  spread: 3,                 // players stay within this many patterns of each other
  gap: 30,                   // patterns between gatherings (minimum)
  restBase: 0.025,           // chance of a short rest at each pattern boundary
  octaveProb: 0.06,          // chance of switching octave when moving to a new pattern
  recruitSec: 30,            // a gathering waits this long at most for everybody to come in
  climaxDb: [0, 7],          // the whole ensemble's crescendo: from the current level up to this (dB), reached at 70% and held
  climaxSec: [24, 40],       // climax length, scaled by the excitement of the patterns in play
  dropoutSec: [14, 24],      // after the climax, players leave one by one, spread over this long
  // sound
  pulse: true,
  drone: null,
  // techniques
  phase: null,
  glass: null,
  wave: null,
  // structural (switch at the next section)
  roster: ['piano1','piano2','organ','violins','viola','cellos','bass','harp','guitar','piccolo','flute','oboe','clarinet','sax','bassoon','horn','trumpet','trombone','tuba','marimba','xylo','glock','timpani','handperc'],
  tuning: '12tet'
};
STYLES.minimal = Object.assign({}, STYLES.inc, {
  label: 'Minimalism: In C + Reich + Glass + Adams + Young',
  tuning: 'ji',
  drone: {
    level: 0.05,
    fadeSec: 4,              // crossfade when the key changes
    partials: [[1, 0.5, 'sine'], [1.5, 0.3, 'sine'], [2, 0.25, 'triangle'], [3, 0.08, 'sine'], [3.5, 0.05, 'sine']]   // tonic, fifth, octave, twelfth, natural seventh
  },
  phase: {
    chance: 0.04,            // chance per boundary that a player starts phasing against a partner on the same pattern
    steps: [2, 4],           // pulses the drifting player moves ahead in one episode
    driftSec: [6, 12],       // time to drift one pulse ahead
    holdSec: [4, 8],         // time locked in each new position
    minGapSec: 25            // quiet time between episodes
  },
  glass: {
    chance: 0.12,            // chance, on reaching a new pattern, that a player builds it up and takes it apart again
    minUnits: 3,             // patterns need at least this many note groups
    reps: [2, 3],            // repetitions of each stage
    maxConcurrent: 2         // players running the process at the same time
  },
  wave: {
    periodSec: [150, 240],   // length of one intensity wave
    rise: 0.7,               // share of the wave spent building (the rest falls away)
    db: [-8, 3],             // loudness from trough to crest
    bright: [0.5, 1.5],      // filter cutoff factor from trough to crest
    restScale: 2.5,          // rests are this much likelier in a trough (and rarer near the crest)
    octave: 2.2,             // octave-doubling factor at the crest
    fill: 0.7,               // chance near the crest that a player turns held notes into repeated pulses
    gatherRampSec: 25        // a gathering drives intensity to its peak over this long
  }
});
const STRUCTURAL = ['roster'];
let ST = STYLES.inc, STYLE_KEY = 'inc', PENDING_STYLE = null;
const TERRY = {spread:3};   // the widest span of patterns between the slowest and fastest player (In C: about 3)
let SPREAD = TERRY.spread;
function structuralChange(a, b){ return STRUCTURAL.some(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); }
/* Returns true if the style took effect now, false if it waits for the next section. */
function applyStyle(key, atSection){
  if (key === 'minimal' || key === 'inc'){ for (const k in TECH_ON) TECH_ON[k] = key === 'minimal'; BASE_KEY = 'inc'; composeStyle(); STYLE_KEY = key; return true; }
  const next = STYLES[key]; if (!next) return false;
  if (!atSection && structuralChange(ST, next)){ PENDING_STYLE = key; return false; }
  ST = next; STYLE_KEY = key; SPREAD = TERRY.spread; PENDING_STYLE = null;
  if (typeof onStyleApplied === 'function') onStyleApplied();
  return true;
}

/* Techniques: individual switches layered on the base style. */
const TECH = {
  reich: {label:'Steve (Reich phasing)', keys:{phase:STYLES.minimal.phase}},
  glass: {label:'Philip (Glass additive process)', keys:{glass:STYLES.minimal.glass}},
  adams: {label:'John (Adams intensity waves)', keys:{wave:STYLES.minimal.wave}},
  young: {label:'La Monte (Young just intonation and drone)', keys:{tuning:'ji', drone:STYLES.minimal.drone}}
};
const TECH_ON = {reich:false, glass:false, adams:false, young:false};
let BASE_KEY = 'inc';
let ROSTER = null;   // the line-up chosen in Setup (null: the default 24)
function composeStyle(){
  const st = Object.assign({}, STYLES[BASE_KEY]);
  for (const [k, t] of Object.entries(TECH)) if (TECH_ON[k]) Object.assign(st, t.keys);
  const on = Object.keys(TECH).filter(k => TECH_ON[k]).map(k => TECH[k].label);
  st.label = STYLES[BASE_KEY].label + (on.length ? ' + ' + on.join(', ') : '');
  if (ROSTER) st.roster = ROSTER.slice();
  ST = st; SPREAD = TERRY.spread;
}
function setTechnique(k, on){ TECH_ON[k] = !!on; composeStyle(); }
