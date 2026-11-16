'use strict';
/* Electronica (in the spirit of Kiasmos and Rival Consoles), switched on by a kit's own fields and only from 50% Techno:
   - prog + hold: a chord loop (scale degrees from the tonic, e.g. [0, 5, 2, 6] = i–VI–III–VII in Aeolian), each chord held
     for `hold` bars; the pattern generator follows it, so the whole ensemble sits on long, slow harmony;
   - pad: a warm, slow-breathing chord on every change, ducked by the kick like everything else;
   - arp: the chord's tones arpeggiated in sixteenths (or eighths), its filter opening slowly across the section's arc,
     closing in the breakdown and wide open for the build;
   - kick: 'broken' (syncopated, softer) or 'half' (half time) instead of four on the floor;
   - tape: gentle saturation on the whole mix. */
const ELEC = {chord:null, bar:-1, arpStep:0, tape:null};
function elecOn(){ const K = kit(); return TECHNO.X >= 0.5 && !!(K.prog && K.prog.length); }
function elecChordDeg(barOffset = 0){
  const K = kit(), bar = Math.floor(E.p/BAR) + barOffset, hold = K.hold || 8;
  return K.prog[mod(Math.floor(bar/hold), K.prog.length)];
}
const DEG_FN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'];
function elecChordFn(){ return DEG_FN[mod(elecChordDeg(1), 7)]; }   // one bar ahead: patterns are generated a little before they sound
function chordMidis(lo){   // the current chord's tones as MIDI notes from `lo` up, root first
  const g = E.gen; if (!g) return [];
  const root = mod(g.keyDeg() + elecChordDeg(), 7), degs = [root, root + 2, root + 4, root + 6];
  return degs.map(d => { let m = g.midiOf(d, g.f); while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }).sort((a, b) => a - b);
}
function elecPulse(p, t){
  if (!E.audio || !ctx || !music) return;
  if (!elecOn() || !E.gen || E.clock < (E.openUntil || 0)) { ELEC.chord = null; return; }
  const K = kit(), step = mod(p, BAR), hold = K.hold || 8, bar = Math.floor(p/BAR);
  const ph = gatherPhase(), anyone = active().length > 0; if (!anyone) return;
  // pad: a new chord at each change
  if (step === 0 && mod(bar, hold) === 0 && bar !== ELEC.bar && K.pad){
    ELEC.bar = bar; const ms = chordMidis(50), dur = hold*BAR*E.period;
    const lvl = 0.032*K.pad*(trackOn() ? SECTION[trackType()].pad : ph === 'call' ? 1.3 : 1);
    ms.slice(0, 4).forEach((m, i) => warmPad(m - (i === 0 ? 12 : 0), t, dur, lvl*(i === 0 ? 0.8 : 1)));
  }
  // arp
  const rate = K.arpRate || 1;
  const arpLv = trackOn() ? SECTION[trackType()].arp*clamp(1 + 0.5*energy(), 0, 1.5) : 1;
  if (K.arp && arpLv > 0 && step % rate === 0){
    const ms = chordMidis(57), seq = ms.concat(ms.map(m => m + 12), ms.slice(1, 3).map(m => m + 24).reverse());
    const m = seq[mod(ELEC.arpStep++, seq.length)];
    const a = E.gen.arcAt(stats().med || 0);
    let open = Math.pow(a, 1.4);
    if (trackOn()){ const S = SECTION[trackType()]; open = trackType() === 'build' ? trackX(p) : S.open ?? open; }
    else if (ph === 'call') open = 0.15; else if (ph === 'climax'){ const G = E.gather; open = clamp((p - G.climax.start)/(G.climax.end - G.climax.start), 0, 1); }
    arpNote(m, t, rate*E.period*0.9, 0.018*K.arp*arpLv, 350 + 5200*open);
  }
}
function warmPad(m, t, dur, vel){
  const f = tunedHz(m), g = ctx.createGain(), F = ctx.createBiquadFilter(); F.type = 'lowpass'; F.frequency.value = 1300; F.Q.value = 0.5;
  F.connect(g); g.connect(music);
  const os = [-9, 0, 8].map(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(F); return o; });
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.15; lg.gain.value = 350; lfo.connect(lg); lg.connect(F.frequency); os.push(lfo);
  const a = Math.min(2.5, dur*0.3), end = t + dur + 1.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0.0001, end);
  os.forEach(o => { o.start(t); o.stop(end + 0.1); });
}
function arpNote(m, t, dur, vel, cut){
  const f = tunedHz(m), g = ctx.createGain(), F = ctx.createBiquadFilter(); F.type = 'lowpass'; F.Q.value = 6; F.frequency.setValueAtTime(cut*1.6, t); F.frequency.exponentialRampToValueAtTime(Math.max(200, cut*0.6), t + 0.12);
  F.connect(g); g.connect(music); echoSend(g, 0.3);
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 6;
  const g2 = ctx.createGain(); g2.gain.value = 0.5; o.connect(F); o2.connect(g2); g2.connect(F);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  for (const x of [o, o2]){ x.start(t); x.stop(t + dur + 0.2); }
}
/* Tape: gentle saturation between the sidechain and the master bus; 0 leaves the sound untouched. */
function setTape(amount){
  if (!ELEC.tape) return;
  const k = 1 + 6*(amount || 0), n = 1024, c = new Float32Array(n);
  const comp = 1/(1 + 2*(amount || 0));   // keep the level roughly where it was: saturation adds loudness
  for (let i = 0; i < n; i++){ const x = 2*i/(n - 1) - 1; c[i] = amount ? comp*Math.tanh(k*x)/Math.tanh(k) : x; }
  ELEC.tape.curve = c;
}
/* Kick patterns other than four on the floor. */
const BROKEN_KICKS = [
  [1,0,0,0, 0,0,0,0.6, 0,0,1,0, 0,0,0,0],
  [1,0,0,0, 0,0,0.5,0, 0,0,1,0, 0,0,0,0.45],
  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0.55,0,0],
];
function kickPattern(K, r = Math.random){
  if (K.kick === 'broken') return BROKEN_KICKS[Math.floor(r()*BROKEN_KICKS.length)].slice();
  if (K.kick === 'half' || K.halftime) return [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0];
  return null;
}
