'use strict';
/* Movement (from 50% Techno, with the track form): sounds change while they play, as in a produced track.
   Five curves run across each track section, start → end, with a slow drift in the long ones:
   - filt: −1 closes a low-pass (down to 250 Hz), +1 opens a high-pass (up to 1.2 kHz): the DJ filter, on drums and bass,
     and more gently on the orchestra;
   - res:  the filter's resonance;
   - len:  note length of kick, hats and bass (1 = as the kit sets it);
   - space: echo (dotted eighths) on clap, percussion, open hat and arp, and the reverb's level;
   - drive: saturation on drums and bass, and tape on the whole mix.
   Four knobs push the curves while playing: Energy (layers, ghost notes, fills, players), Filter, Space, Drive. */
const MOVE = {cur:{filt:0, res:0, len:1, space:0, drive:0}, knob:{energy:0, filter:0, space:0, drive:0},
  tlp:null, thp:null, tsat:null, mhp:null, echoIn:null, delay:null, lastTape:-1, lastSat:-1};
const CURVES = {   // per section: [start, end]
  intro:     {filt:[-0.5, -0.15], res:[0.2, 0.3],  len:[0.8, 0.9],  space:[0.5, 0.35], drive:[0, 0.1]},
  groove:    {filt:[0, 0],        res:[0.15, 0.15], len:[1, 1],     space:[0.25, 0.25], drive:[0.15, 0.15]},
  peak:      {filt:[0, 0],        res:[0.15, 0.2], len:[1.1, 1.2],  space:[0.2, 0.2],  drive:[0.3, 0.4]},
  breakdown: {filt:[-0.35, -0.5], res:[0.3, 0.35], len:[1.3, 1.3],  space:[0.6, 0.8],  drive:[0.05, 0.05]},
  build:     {filt:[-0.5, 0.25],  res:[0.3, 0.75], len:[1, 0.7],    space:[0.4, 0.7],  drive:[0.1, 0.45]},
  drop:      {filt:[0, 0],        res:[0.15, 0.15], len:[1.1, 1.1], space:[0.15, 0.2], drive:[0.4, 0.35]},
  outro:     {filt:[0, -0.6],     res:[0.2, 0.3],  len:[1, 0.8],    space:[0.3, 0.6],  drive:[0.2, 0]}
};
const DRIFT = {groove:1, peak:1, drop:0.7};   // a slow sway of filter and resonance over 16 bars in the long sections

function initMovement(){
  // drums and bass: drumBus → low-pass → high-pass → saturation → bus
  MOVE.tlp = ctx.createBiquadFilter(); MOVE.tlp.type = 'lowpass'; MOVE.tlp.frequency.value = 20000; MOVE.tlp.Q.value = 0.7;
  MOVE.thp = ctx.createBiquadFilter(); MOVE.thp.type = 'highpass'; MOVE.thp.frequency.value = 20; MOVE.thp.Q.value = 0.7;
  MOVE.tsat = ctx.createWaveShaper(); MOVE.tsat.oversample = '2x'; setSat(0);
  drumBus.disconnect(); drumBus.connect(MOVE.tlp); MOVE.tlp.connect(MOVE.thp); MOVE.thp.connect(MOVE.tsat); MOVE.tsat.connect(bus);
  // the orchestra: its build filter (mlp) → high-pass → sidechain
  MOVE.mhp = ctx.createBiquadFilter(); MOVE.mhp.type = 'highpass'; MOVE.mhp.frequency.value = 20; MOVE.mhp.Q.value = 0.6;
  mlp.disconnect(); mlp.connect(MOVE.mhp); MOVE.mhp.connect(duck);
  // echo: dotted eighths with filtered feedback
  MOVE.echoIn = ctx.createGain(); MOVE.echoIn.gain.value = 0;
  const d = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), out = ctx.createGain();
  d.delayTime.value = 3*E.period; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 3200; hp.type = 'highpass'; hp.frequency.value = 300; out.gain.value = 0.8;
  MOVE.echoIn.connect(hp); hp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(bus);
  MOVE.delay = d;
}
function setSat(a){
  if (!MOVE.tsat) return;
  // unity gain for quiet signals, peaks rounded off: it thickens without getting louder
  const k = 1 + 5*a, n = 1024, c = new Float32Array(n), makeup = 1 + 0.4*a;
  for (let i = 0; i < n; i++){ const x = 2*i/(n - 1) - 1; c[i] = a > 0.001 ? makeup*Math.tanh(k*x)/k : x; }
  MOVE.tsat.curve = c;
}
/* A voice sends to the echo: amt is its own share, scaled by the current Space. */
function echoSend(node, amt){
  if (!MOVE.echoIn || amt <= 0 || !trackOn()) return;
  const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(MOVE.echoIn);
}
function moveLen(){ return trackOn() ? MOVE.cur.len : 1; }
function energy(){ return trackOn() ? MOVE.knob.energy : 0; }
/* The planned value of every curve at pulse p. */
function planned(p){
  const t = trackType(), C = CURVES[t] || CURVES.groove, x = trackX(p), o = {};
  for (const k in C) o[k] = lerp(C[k][0], C[k][1], x);
  const dr = DRIFT[t] || 0;
  if (dr){ const ph = 2*Math.PI*(Math.floor(p/BAR) + mod(p, BAR)/BAR)/16; o.filt += dr*0.12*Math.sin(ph) - 0.04*dr; o.res += dr*0.1*(0.5 + 0.5*Math.sin(ph + 1)); }
  return o;
}
/* Every pulse, from technoPulse. */
function movePulse(p, t){
  if (!ctx || !MOVE.tlp) return;
  const on = trackOn(), K = MOVE.knob;
  const goal = on ? planned(p) : {filt:0, res:0, len:1, space:0, drive:0};
  if (on){ goal.filt = clamp(goal.filt + K.filter, -1, 1); goal.space = clamp(goal.space + 0.8*K.space, -1, 1); goal.drive = clamp(goal.drive + 0.6*K.drive, 0, 1); goal.len *= 1 + 0.15*K.energy; }
  const c = MOVE.cur, a = 0.06;
  for (const k in goal) c[k] += (goal[k] - c[k])*a;
  if (p % 2) return;
  // filter
  const f = c.filt, q = 0.7 + 9*clamp(c.res, 0, 1)*Math.min(1, Math.abs(f)*3 + 0.15);
  const lpf = f < 0 ? 20000*Math.pow(250/20000, -f) : 20000, hpf = f > 0 ? 20*Math.pow(1200/20, f) : 20;
  MOVE.tlp.frequency.setTargetAtTime(lpf, t, 0.05); MOVE.thp.frequency.setTargetAtTime(hpf, t, 0.05);
  MOVE.tlp.Q.setTargetAtTime(f < 0 ? q : 0.7, t, 0.1); MOVE.thp.Q.setTargetAtTime(f > 0 ? q : 0.7, t, 0.1);
  MOVE.mhp.frequency.setTargetAtTime(f > 0 ? 20*Math.pow(600/20, f) : 20, t, 0.05);
  // space: echo and reverb
  const sp = c.space;
  MOVE.echoIn.gain.setTargetAtTime(on ? 0.9*smooth(-0.2, 1, sp) : 0, t, 0.2);
  if (p % BAR === 0) MOVE.delay.delayTime.setTargetAtTime(Math.min(1.9, 3*E.period), t, 0.05);
  if (wetGain){ const base = TECHNO.wet ?? 0.28; wetGain.gain.setTargetAtTime(on ? base*clamp(1 + 0.9*sp, 0.2, 2) : base, t, 0.3); }
  // drive
  if (p % 8 === 0){
    const dv = on ? clamp(c.drive, 0, 1) : 0;
    if (Math.abs(dv - MOVE.lastSat) > 0.02){ MOVE.lastSat = dv; setSat(0.8*dv); }
    const tp = clamp((kit().tape || 0) + (on ? 0.35*dv : 0), 0, 1);
    if (Math.abs(tp - MOVE.lastTape) > 0.02){ MOVE.lastTape = tp; setTape(tp); }
  }
}
function resetKnobs(){ MOVE.knob = {energy:0, filter:0, space:0, drive:0}; MOVE.lastTape = -1; if (typeof syncKnobs === 'function') syncKnobs(); }
