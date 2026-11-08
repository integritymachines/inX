'use strict';
/* Time layer: the shared pulse clock, and per-player timing.
   Each player has a rate (1 = on the pulse) and a start position for its next repetition, in pulses.
   A drifting player's start positions are fractional; its notes are placed in time from them. */
const EPS = 1e-6;
function pulseTimeOf(q, p, t){ return t + (q - p)*E.period; }     // time of fractional pulse position q, given pulse p at time t
function perPulse(a){ return E.period/(a.rate || 1); }               // seconds per pulse for this player
function repLength(a, len){ return len/(a.rate || 1); }              // a repetition's length in shared pulses
function snapToGrid(a, p){ a.rate = 1; a.nextStart = Math.max(PPE*Math.ceil((p + 1)/PPE), PPE*Math.round(a.nextStart/PPE)); }   // back onto the eighth-note grid

/* Reich phasing: a follower plays the same pattern as a leader, speeds up until it is one pulse ahead,
   locks there for a while, and repeats; after a few steps both carry on, the follower displaced. */
const STEVE = {amount:0.5};   // 0–1; 0.5 is the original setting: scales how often phasing starts and shortens the quiet between episodes
function phaseActive(a){ return !!(E.phase && (E.phase.lead === a || E.phase.fol === a)); }
function maybeStartPhase(a, S){
  const C = ST.phase; if (!C || E.phase || E.gather || a.resting || a.glass || strictGrid(a)) return false;
  if (E.clock < (E.phaseQuietUntil || 0) || Math.random() >= C.chance*STEVE.amount/0.5) return false;
  const partners = S.act.filter(x => x !== a && x.mode === 'flow' && !x.resting && !x.leaving && x.idx === a.idx && !x.glass && Math.abs(x.nextStart - Math.round(x.nextStart)) < EPS);
  if (!partners.length) return false;
  const lead = partners[Math.floor(Math.random()*partners.length)];
  const len = E.gen.get(a.idx).len, repSec = len*E.period;
  const rnd = ([lo, hi]) => lo + Math.random()*(hi - lo);
  const R = Math.max(2, Math.round(rnd(C.driftSec)/repSec));
  const H = Math.max(1, Math.round(rnd(C.holdSec)/repSec));
  const steps = C.steps[0] + Math.floor(Math.random()*(C.steps[1] - C.steps[0] + 1));
  E.phase = {lead, fol:a, idx:a.idx, len, R, H, steps, step:0, stage:'drift', left:R, shift:0};
  a.rate = len/(len - 1/R);
  log(`${name(a)} starts phasing against ${name(lead)} on pattern ${a.idx}`);
  return true;
}
/* Called at the follower's boundary (before it plays its next repetition). */
function phaseStep(a, p){
  const F = E.phase; F.left--;
  if (F.left > 0) return;
  if (F.stage === 'drift'){
    F.shift++; F.step++;
    a.rate = 1; a.nextStart = Math.round(a.nextStart);
    F.stage = 'hold'; F.left = F.H;
    if (F.step >= F.steps) endPhase(p, `${name(a)} settles ${F.shift} pulse${F.shift > 1 ? 's' : ''} ahead of ${name(F.lead)}`);
  } else {
    F.stage = 'drift'; F.left = F.R; a.rate = F.len/(F.len - 1/F.R);
  }
}
function endPhase(p, msg){
  const F = E.phase; if (!F) return;
  if (F.fol.rate !== 1 || Math.abs(F.fol.nextStart - Math.round(F.fol.nextStart)) > EPS) snapToGrid(F.fol, p);
  E.phase = null; E.phaseQuietUntil = E.clock + (ST.phase ? ST.phase.minGapSec*0.5/Math.max(0.1, STEVE.amount) : 0);
  if (msg) log(msg);
}

/* Scheduler: schedules pulses a little ahead of the audio clock. */
function tick(){
  if (!E.running || !ctx) return;
  if (E.nextT < ctx.currentTime - 0.05) E.nextT = ctx.currentTime + 0.02;
  const ahead = ctx.currentTime + 0.15;
  while (E.nextT < ahead){ pulse(E.nextT); E.nextT += E.period; }
}
setInterval(tick, 25);

