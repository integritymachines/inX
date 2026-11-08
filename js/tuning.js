'use strict';
/* Tuning layer.
   '12tet': equal temperament.
   'ji': 5-limit just intonation on the current key's tonic (the tonic itself stays at its equal-tempered pitch),
   with a 7/4 natural seventh in place of the minor seventh. At a key change the whole ensemble retunes in one clean step.
   A drone (Young) sounds the tonic with its fifth, octave, twelfth and natural seventh, and moves with the key. */
const JI = [1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 7/4, 15/8];
let TUNE_TONIC = 0, DRONE = null;
const LAMONTE = {drone:0.5};   // drone level (0–1; 0.5 is the original setting); at 0 the just intonation stays, the drone is silent
function initTuning(){ TUNE_TONIC = 0; }
function etHz(m){ return 440*Math.pow(2, (m - 69)/12); }
function tunedHz(m){
  if (ST.tuning !== 'ji') return etHz(m);
  const rel = mod(Math.round(m) - TUNE_TONIC, 12);
  return etHz(Math.round(m) - rel)*JI[rel];
}
/* The key in force is the key of the newest pattern in play. */
function updateTuning(){
  const S = stats(); if (!S.act.length || !E.gen) return;
  const top = E.gen.pats[S.hi]; if (!top) return;
  const t = mod(7*top.s, 12);
  if (t !== TUNE_TONIC){ TUNE_TONIC = t; if (ST.tuning === 'ji' || ST.drone) log(`Retuned to ${keyName(top.s).replace(' major', '')}`); }
}
function droneTick(){
  if (!ctx || !E.audio) return;
  const want = !!ST.drone && E.running && LAMONTE.drone > 0.01;
  if (!want){ if (DRONE){ droneStop(DRONE); DRONE = null; } return; }
  if (!DRONE || DRONE.pc !== TUNE_TONIC){ if (DRONE) droneStop(DRONE); DRONE = droneStart(TUNE_TONIC); }
  DRONE.g.gain.setTargetAtTime(ST.drone.level*(LAMONTE.drone/0.5)*lerp(0.6, 1.4, E.I), ctx.currentTime, 1.5);
}
function droneStart(pc){
  const f0 = etHz(36 + pc), now = ctx.currentTime;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(duck || bus);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(g);
  const oscs = ST.drone.partials.map(([ratio, amp, type]) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f0*ratio;
    const a = ctx.createGain(); a.gain.value = amp; o.connect(a); a.connect(lp); o.start(now); return o;
  });
  g.gain.setTargetAtTime(ST.drone.level, now, ST.drone.fadeSec/3);
  return {pc, g, oscs};
}
function droneStop(d){
  const now = ctx.currentTime;
  d.g.gain.cancelScheduledValues(now); d.g.gain.setTargetAtTime(0, now, (ST.drone ? ST.drone.fadeSec : 3)/3);
  d.oscs.forEach(o => o.stop(now + 8));
}
