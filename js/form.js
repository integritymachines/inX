'use strict';
/* Form layer: Adams-style intensity waves.
   One intensity value I (0–1) rises slowly and falls faster, wave after wave.
   It drives loudness, brightness, density (rests, pulsing repeated notes) and register together.
   A gathering pushes I to its peak, so the climax is the crest; after the drop the next section starts in a trough.
   Without a wave in the style, I stays at a neutral 0.5 and nothing reads it. */
function initForm(){ E.wave = {phase:0, period:200, gI:0}; E.I = ST.wave ? 0.1 : 0.5; }
function waveShape(ph, rise){ return ph < rise ? Math.pow(ph/rise, 1.6) : 1 - Math.pow((ph - rise)/(1 - rise), 0.8); }
function formStep(dt){
  const W = ST.wave; if (!E.wave) initForm();
  if (!W){ E.I = 0.5; if (E.gen) E.gen.waveHint = null; return; }
  const w = E.wave;
  w.phase += dt/w.period;
  if (w.phase >= 1){ w.phase -= 1; w.period = W.periodSec[0] + Math.random()*(W.periodSec[1] - W.periodSec[0]); }
  const iw = 0.08 + 0.92*waveShape(w.phase, W.rise);
  w.gI = E.gather ? Math.min(1, w.gI + dt/W.gatherRampSec) : Math.max(0, w.gI - dt/6);
  E.I = Math.max(iw, w.gI);
  if (E.gen) E.gen.waveHint = clamp(0.5 + (E.I - 0.5)*wDepth(), 0, 1);
}
function waveRising(){ return !!(ST.wave && E.wave && E.wave.phase < ST.wave.rise); }
function waveTrough(){ if (E.wave) E.wave.phase = 0; }   // the gathering's push fades out over a few seconds
const lerp = (a, b, x) => a + (b - a)*x;
/* Effects, all neutral without a wave. */
/* John's depth (0–1; 0.7 is the original setting) scales how far every wave effect moves from its middle. */
const JOHN = {depth:0.7};
function wDepth(){ return JOHN.depth/0.7; }
function waveGain(){ const W = ST.wave; if (!W) return 1; const mid = (W.db[0] + W.db[1])/2; return Math.pow(10, (mid + (lerp(W.db[0], W.db[1], E.I) - mid)*wDepth())/20); }
function waveBright(){ const W = ST.wave; return W ? Math.max(0.2, 1 + (lerp(W.bright[0], W.bright[1], E.I) - 1)*wDepth()) : 1; }
function waveRestScale(){ const W = ST.wave; return W ? Math.max(0.1, 1 + (lerp(W.restScale, 0.3, E.I) - 1)*wDepth()) : 1; }
/* With a wave, octave switches aim up more often as intensity rises; without one, they just flip. */
function waveOctaveUp(a){ return ST.wave ? Math.random() < clamp(0.35 + (lerp(0.05, 0.7, E.I) - 0.35)*wDepth(), 0.02, 0.9) : !a.octUp; }
function waveFill(){ const W = ST.wave; return W ? clamp(clamp((E.I - 0.55)/0.45, 0, 1)*W.fill*wDepth(), 0, 0.95) : 0; }
function waveHazard(){
  const W = ST.wave; if (!W) return 1;
  if (E.I > 0.65 && waveRising()) return 4;
  return E.I < 0.4 ? 0.15 : 0.6;
}
/* Adams's pulsing: held notes become repeated pulses. */
function fillNotes(P){
  const notes = [], midi = [];
  P.notes.forEach((n, j) => {
    if (n.d >= 2*PPE) for (let k=0;k<n.d;k+=PPE){ notes.push({o:n.o + k, d:Math.min(PPE, n.d - k), deg:n.deg, acc:k === 0}); midi.push(P.midi[j]); }   // repeated eighths
    else { notes.push(n); midi.push(P.midi[j]); }
  });
  return {len:P.len, notes, midi, ex:P.ex};
}
