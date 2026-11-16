'use strict';
/* Track form (from 50% Techno): the techno layer follows a plan of sections, as a produced track does —
   intro, groove, peak, breakdown, build, drop, outro — each some bars long, each with its own set of layers,
   filter and tension. When the plan ends, the next track begins with a new groove.
   The orchestra's gatherings steer the plan: calling everybody in jumps to a breakdown (held until the climax),
   the climax becomes the build (as long as the crescendo), and the dropout is the drop; the plan carries on from there.
   A kit (scene) may bring its own plan as kit.form = [[type, bars], ...]; otherwise one of FORMS is chosen. */
const TRACK = {plan:null, sec:0, bar:0, n:0, name:'', wait:null, lastBar:-1};
const FORMS = {
  classic: [['intro', 16], ['groove', 32], ['breakdown', 16], ['build', 8], ['drop', 32], ['groove', 16], ['outro', 16]],
  long:    [['intro', 16], ['groove', 32], ['peak', 32], ['breakdown', 16], ['build', 8], ['drop', 32], ['peak', 16], ['outro', 16]],
  rolling: [['intro', 16], ['groove', 64], ['breakdown', 8], ['build', 8], ['drop', 32], ['outro', 16]],
  double:  [['intro', 16], ['groove', 32], ['breakdown', 8], ['build', 8], ['drop', 32], ['breakdown', 16], ['build', 8], ['drop', 32], ['outro', 16]]
};
/* Per section: drum and bass gates (0–1), the orchestra's filter cutoff (Hz), pad and arp levels, and the arp's filter (null: follows the arc). */
const SECTION = {
  intro:     {label:'Intro',     gates:{kick:1, hat:0.7, clap:0,   ohat:0,   perc:0.6, bass:0},   cut:2600,  pad:0.5, arp:0,   open:0.2},
  groove:    {label:'Groove',    gates:{kick:1, hat:1,   clap:1,   ohat:0.8, perc:1,   bass:1},   cut:20000, pad:0.8, arp:0.7, open:null},
  peak:      {label:'Peak',      gates:{kick:1, hat:1,   clap:1,   ohat:1,   perc:1,   bass:1},   cut:20000, pad:1,   arp:1,   open:0.85},
  breakdown: {label:'Breakdown', gates:{kick:0, hat:0.5, clap:0,   ohat:0.3, perc:0.6, bass:0},   cut:1300,  pad:1.3, arp:0.5, open:0.15},
  build:     {label:'Build',     gates:{kick:0, hat:1,   clap:0,   ohat:0.9, perc:0.8, bass:0},   cut:1300,  pad:1,   arp:1,   open:0},   // x-dependent, below
  drop:      {label:'Drop',      gates:{kick:1, hat:1,   clap:1,   ohat:1,   perc:1,   bass:1},   cut:20000, pad:1,   arp:1,   open:0.9},
  outro:     {label:'Outro',     gates:{kick:1, hat:0.8, clap:0.5, ohat:0,   perc:0.7, bass:0},   cut:3500,  pad:0.5, arp:0.3, open:0.3}
};
function trackOn(){ return technoForm() && !!TRACK.plan; }
function trackSec(){ return TRACK.plan ? TRACK.plan[TRACK.sec] : null; }
function trackType(){ const s = trackSec(); return s ? s.type : null; }
function trackNext(){ return TRACK.plan ? TRACK.plan[TRACK.sec + 1] || null : null; }
/* Progress through the current section, 0–1, at pulse p. */
function trackX(p){ const s = trackSec(); return s ? clamp((TRACK.bar*BAR + mod(p, BAR))/(s.bars*BAR), 0, 1) : 0; }

function newTrack(first){
  const K = kit();
  let src = K.form, name = 'own form';
  if (!src){ const keys = Object.keys(FORMS); name = keys[Math.floor(Math.random()*keys.length)]; src = FORMS[name]; }
  TRACK.plan = src.map(([type, bars]) => ({type, bars}));
  TRACK.sec = 0; TRACK.bar = 0; TRACK.n++; TRACK.name = name; TRACK.wait = null;
  if (!first && TECHNO.X >= 0.2) newGroove();
  if (E.started) log(`Track ${TRACK.n} (${name}): ${TRACK.plan.map(s => SECTION[s.type].label.toLowerCase() + ' ' + s.bars).join(', ')}`);
  enterSection(null);
}
function enterSection(t){
  const s = trackSec(); if (!s) return;
  if (E.started) log(`${SECTION[s.type].label} (${s.bars} bars)`);
  if (t == null || !ctx) return;
  if (s.type === 'build') riser(t, s.bars*BAR*E.period);
  if (s.type === 'drop'){ TECHNO.gate.kick = 1; TECHNO.gate.bass = 1; crash(t); }   // the kick slams back
}
/* Jump to the next section of a type (or insert one), optionally with a new length. */
function trackJump(type, bars, t){
  if (!TRACK.plan) newTrack(true);
  let i = TRACK.plan.findIndex((s, k) => k > TRACK.sec && s.type === type);
  if (i < 0){ TRACK.plan.splice(TRACK.sec + 1, 0, {type, bars: bars || 16}); i = TRACK.sec + 1; }
  // drop what was skipped, so the plan reads as it plays
  TRACK.plan.splice(TRACK.sec + 1, i - TRACK.sec - 1); i = TRACK.sec + 1;
  if (bars) TRACK.plan[i].bars = bars;
  TRACK.sec = i; TRACK.bar = 0; TRACK.wait = null;
  enterSection(t);
}
/* At each bar line (from technoPulse). */
function trackBar(p, t){
  if (!technoForm()) return;
  if (!TRACK.plan){ newTrack(true); return; }
  if (TRACK.wait && TRACK.wait()) return;            // a breakdown held for the gathering's climax
  TRACK.bar++;
  const s = trackSec();
  if (TRACK.bar >= s.bars){
    if (TRACK.sec + 1 >= TRACK.plan.length) { newTrack(false); return; }
    TRACK.sec++; TRACK.bar = 0; enterSection(t);
  }
}
/* The gathering steers the plan. */
function trackGather(ph, G, p, t){
  if (!technoForm()) return;
  if (!TRACK.plan) newTrack(true);
  if (ph === 'call'){
    if (trackType() !== 'breakdown') trackJump('breakdown', 8, t);
    TRACK.wait = () => !!E.gather && !E.gather.dropping && TRACK.bar >= trackSec().bars - 1;   // hold its last bar until the climax takes over
  } else if (ph === 'climax' && G && G.climax){
    trackJump('build', Math.max(2, Math.round((G.climax.end - p)/BAR)), t);
  } else if (ph === 'dropout'){
    if (trackType() !== 'drop') trackJump('drop', 32, t);
  }
}
/* What the section asks of the drums now; build gates and cutoff rise with progress. */
function trackGates(p){
  const s = trackSec(), S = SECTION[s.type], g = {...S.gates};
  if (s.type === 'build'){ const x = trackX(p); g.hat = lerp(0.6, 1, x); g.ohat = lerp(0.4, 0.9, x); }
  return g;
}
function trackCutoff(p){
  const s = trackSec(); if (s.type === 'build') return 1300*Math.pow(15, trackX(p));
  return SECTION[s.type].cut;
}
