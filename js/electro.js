'use strict';
/* Electronic voices: each of the 24 players has a synthesized counterpart for club styles, and crossfades
   from its recording to it (equal power) as the electronic mix rises. Built only from Web Audio nodes, so the
   same code renders offline for calibration. Families: pianos → stabs, organ and upper strings → pads,
   low strings and bassoon → reese, bass and tuba → sub, harp and guitar → plucks, winds → leads,
   brass → brass stabs, mallets → FM bells, timpani → toms, hand percussion → FM clicks. */
const ELECTRO = {
  piano1:{type:'stab', bright:1.1}, piano2:{type:'stab', bright:0.8}, organ:{type:'pad', bright:0.9},
  violins:{type:'pad', bright:1.3}, viola:{type:'pad', bright:1.0}, cellos:{type:'reese', bright:1.0},
  bass:{type:'sub', bright:1}, harp:{type:'pluck', bright:1.2}, guitar:{type:'pluck', bright:0.8},
  piccolo:{type:'lead', bright:1.4, wave:'square'}, flute:{type:'lead', bright:1.1, wave:'triangle'},
  oboe:{type:'lead', bright:1.0, wave:'pulse'}, clarinet:{type:'lead', bright:0.9, wave:'square'},
  sax:{type:'lead', bright:1.0, wave:'sawtooth'}, bassoon:{type:'reese', bright:0.8},
  horn:{type:'brass', bright:0.8}, trumpet:{type:'brass', bright:1.3}, trombone:{type:'brass', bright:0.9},
  tuba:{type:'sub', bright:1}, marimba:{type:'fm', ratio:4, index:2, decay:0.5}, xylo:{type:'fm', ratio:3.5, index:3, decay:0.25},
  glock:{type:'fm', ratio:1.41, index:4, decay:1.4}, timpani:{type:'tom'}, handperc:{type:'click'},
  congas:{type:'tom'}, darbuka:{type:'tom'}, bells:{type:'click'}
};
let PULSE_WAVE = null;
function pulseWave(c){
  if (PULSE_WAVE && PULSE_WAVE.c === c) return PULSE_WAVE.w;
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k=1;k<n;k++) im[k] = (2/(k*Math.PI))*Math.sin(k*Math.PI*0.25);   // 25% pulse
  const w = c.createPeriodicWave(re, im); PULSE_WAVE = {c, w}; return w;
}
let CLICK_NOISE = null;
function clickNoise(c){ if (CLICK_NOISE && CLICK_NOISE.c === c) return CLICK_NOISE.b; const n = Math.floor(c.sampleRate*0.2), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i=0;i<n;i++) d[i] = Math.random()*2 - 1; CLICK_NOISE = {c, b}; return b; }
/* Plays one electronic note into dest; returns nothing. */
function electroVoice(key, m, t, dur, vel, bright, dest){
  const c = dest.context, P = ELECTRO[key], f = tunedHz(m), b = (P.bright || 1)*bright;
  const g = c.createGain(); g.connect(dest);
  const oscs = [];
  const osc = (type, fr, det, amp, to) => {
    const o = c.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave(c)); else o.type = type;
    o.frequency.value = fr; o.detune.value = det || 0;
    const a = c.createGain(); a.gain.value = amp; o.connect(a); a.connect(to); oscs.push(o); return o;
  };
  const lp = (fr, q = 0.7) => { const x = c.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = Math.min(16000, fr); x.Q.value = q; x.connect(g); return x; };
  const adsr = (a, d, s, r) => { const h = Math.max(dur, a + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.linearRampToValueAtTime(vel*s, t + a + d); g.gain.setValueAtTime(vel*s, t + h); g.gain.linearRampToValueAtTime(0, t + h + r); return t + h + r; };
  let end;
  switch (P.type){
    case 'stab': { const F = lp(4000*b, 4); F.frequency.setValueAtTime(Math.min(16000, 4500*b), t); F.frequency.exponentialRampToValueAtTime(500, t + 0.16);
      osc('sawtooth', f, -12, 0.5, F); osc('sawtooth', f, 12, 0.5, F); osc('square', f/2, 0, 0.3, F);
      end = adsr(0.003, 0.18, 0.25, 0.12); break; }
    case 'pad': { const F = lp(1600*b, 0.8); osc('sawtooth', f, -9, 0.4, F); osc('sawtooth', f, 9, 0.4, F); osc('sawtooth', f, 0, 0.3, F);
      end = adsr(0.12, 0.2, 0.8, 0.45); break; }
    case 'reese': { const F = lp(520*b, 1.2); osc('sawtooth', f, -18, 0.55, F); osc('sawtooth', f, 18, 0.55, F);
      end = adsr(0.015, 0.1, 0.85, 0.15); break; }
    case 'sub': { const F = lp(320, 0.7); osc('sine', f, 0, 1, F); osc('triangle', f, 0, 0.35, F);
      end = adsr(0.006, 0.08, 0.85, 0.1); break; }
    case 'pluck': { const F = lp(5000*b, 2); F.frequency.setValueAtTime(Math.min(16000, 6000*b), t); F.frequency.exponentialRampToValueAtTime(320, t + 0.22);
      osc('sawtooth', f, 0, 0.6, F); osc('square', f, 7, 0.3, F);
      end = adsr(0.002, 0.3, 0.05, 0.1); break; }
    case 'lead': { const F = lp(2800*b, 2); const o = osc(P.wave || 'square', f, 0, 0.55, F); osc('sawtooth', f, 5, 0.2, F);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f*0.006, t + 0.25);
      lfo.connect(lg); lg.connect(o.frequency); oscs.push(lfo);
      end = adsr(0.01, 0.1, 0.8, 0.1); break; }
    case 'brass': { const F = lp(700, 1.5); F.frequency.setValueAtTime(600, t); F.frequency.linearRampToValueAtTime(Math.min(16000, 3200*b), t + 0.06); F.frequency.linearRampToValueAtTime(1500*b, t + 0.3);
      osc('sawtooth', f, -6, 0.4, F); osc('sawtooth', f, 6, 0.4, F); osc('sawtooth', f/2, 0, 0.2, F);
      end = adsr(0.03, 0.15, 0.7, 0.12); break; }
    case 'fm': { const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
      car.frequency.value = f; mod.frequency.value = f*P.ratio; mg.gain.setValueAtTime(f*P.index*b, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f*0.05), t + P.decay*0.6);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); oscs.push(car, mod);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + P.decay + Math.min(dur, 0.3)); end = t + P.decay + Math.min(dur, 0.3); break; }
    case 'tom': { const o = osc('sine', f*1.6, 0, 1, g); o.frequency.setValueAtTime(f*1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); end = t + 0.36; break; }
    case 'click': {   // unpitched: register picks the colour
      const n = c.createBufferSource(), bp = c.createBiquadFilter(); n.buffer = clickNoise(c); bp.type = 'bandpass'; bp.Q.value = 6;
      bp.frequency.value = 400*Math.pow(2, clamp((m - 40)/12, 0, 4)); n.connect(bp); bp.connect(g); oscs.push(n);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); end = t + 0.08; break; }
  }
  for (const o of oscs){ o.start(t); o.stop(end + 0.05); }
}
/* How electronic the players sound: a preset's setting, or (for custom settings) rising with the Techno amount. */
function elecMix(){
  if (TECHNO.kit && TECHNO.kit.elec !== undefined) return TECHNO.kit.elec*smooth(0.4, 0.6, TECHNO.X);
  return smooth(0.7, 0.95, TECHNO.X);
}
