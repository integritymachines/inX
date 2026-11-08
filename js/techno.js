'use strict';
/* Techno: one amount X (0–1) moves In X from orchestra toward techno.
   0 → 25%: the tempo glides to 128 BPM, the pulse becoming a 16th note; from 15% entries snap to the beat.
   20% kick · 35% closed hats · 40% clap · 45% open hats · 50% entries snap to the bar and the foundation group locks
   to strict 4/4 · 55% percussion · 60% bass line and sidechain pumping, deepening up to 100%.
   Line and color players keep In C's free pattern lengths, so they run in polymeter against the 4/4 grid.
   The drums are synthesized, as techno's drum machines are, and evolve slowly at phrase boundaries (8 bars). */
const TECHNO = {X:0, userPeriod:0.1, bpm:128, on:{}, level:{}, gate:{}, base:{}, pat:{}, bassLine:[], lastBar:-1, kit:null, prevBass:null, epochSeen:0, phase:'flow', fill:null};
const BAR = 16, PHRASE = 8*16;
/* A drum kit: how each voice sounds and how its patterns are made. Presets supply their own; this is plain techno. */
const KIT_DEFAULT = {kickDecay:0.42, kickPitch:[155, 48], hatDecay:0.045, openDecay:0.28, clap:'clap', bass:'sub', swing:0, pump:0.6,
  halftime:false, hatK:[10, 16], percK:[3, 7], gains:{}};
function kit(){ return TECHNO.kit || KIT_DEFAULT; }
const smooth = (a, b, x) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
function technoPeriod(){ return TECHNO.userPeriod; }   // one tempo for everything; shown as ms per pulse below 25% Techno, as BPM (pulse = 16th note) above
function bpmOf(period){ return Math.round(60/(4*period)); }
function gridStep(){ return TECHNO.X >= 0.5 ? BAR : TECHNO.X >= 0.15 ? 4 : PPE; }   // entries land at least on an eighth note
function snapUp(p){ const g = gridStep(); return Math.ceil(p/g)*g; }
function strictGrid(a){ return TECHNO.X >= 0.5 && (SECTIONS[a.sec].role === 'foundation' || MODE.gridAll); }   // Focus locks every player to 4/4
function pow2len(len){ let L = 4; while (L < len) L *= 2; return L; }
function technoStage(){
  const X = TECHNO.X;
  if (X <= 0) return 'orchestra';
  if (X < 0.2) return 'tempo';
  if (X < 0.35) return 'kick';
  if (X < 0.5) return 'hats & clap';
  if (X < 0.6) return 'locked grid';
  return 'bass & pump';
}
const DRUMS = [
  {key:'kick', label:'Kick',       at:0.2,  gain:1.0},
  {key:'hat',  label:'Closed hat', at:0.35, gain:0.32},
  {key:'clap', label:'Clap',       at:0.4,  gain:0.5},
  {key:'ohat', label:'Open hat',   at:0.45, gain:0.28},
  {key:'perc', label:'Percussion', at:0.55, gain:0.38},
  {key:'bass', label:'Bass line',  at:0.6,  gain:0.55}
];
function euclid(k, n = 16, rot = 0){ const out = []; for (let i=0;i<n;i++) out.push(Math.floor((i*k)/n) !== Math.floor(((i-1)*k)/n) ? 1 : 0); return out.map((_, i) => out[mod(i - rot, n)]); }
function hatPattern(k){ return euclid(k, 16).map((v, i) => v*(i % 2 ? 0.9 : 0.55)); }
function makeBass(type){
  const L = [...Array(16)].map(() => ({v:0, tone:0, oct:0, acc:false, slide:false}));
  const set = (i, o = {}) => Object.assign(L[i], {v:0.85}, o);
  if (type === 'rumble') for (let i=0;i<16;i++){ if (i % 4) set(i, {v:i % 4 === 2 ? 0.85 : 0.6}); }
  else if (type === 'house') [[2,0],[3,1],[6,0],[10,0],[11,1],[14,0]].forEach(([i, o]) => set(i, {oct:o}));
  else if (type === 'acid') for (let i=0;i<16;i++){ if (Math.random() < 0.7 || i === 0) set(i, {tone:[0,0,0,1,2][Math.floor(Math.random()*5)], oct:Math.random() < 0.3 ? 1 : 0, acc:Math.random() < 0.3, slide:Math.random() < 0.22}); }
  else [2,3,6,10,11,14].forEach(i => set(i));
  return L;
}
function initTechno(){
  const K = kit();
  TECHNO.pat = {
    kick: K.halftime ? [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] : [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    hat:  hatPattern(Math.round((K.hatK[0] + K.hatK[1])/2)),
    clap: K.halftime ? [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] : [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    ohat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    perc: euclid(K.percK[0], 16, 2).map(v => v*0.8),
    bass: null
  };
  TECHNO.bassLine = makeBass(K.bass); TECHNO.pat.bass = TECHNO.bassLine.map(x => x.v);
  TECHNO.base = TECHNO.pat; TECHNO.pat = cloneBar(TECHNO.base);
  TECHNO.lastBar = -1; TECHNO.epochSeen = E.gen ? E.gen.epoch : 0; TECHNO.phase = 'flow';
  for (const d of DRUMS){ TECHNO.on[d.key] = TECHNO.on[d.key] || false; TECHNO.level[d.key] = TECHNO.level[d.key] || 0; TECHNO.gate[d.key] = 1; }
}
function cloneBar(B){ const P = {}; for (const k in B) P[k] = B[k].slice(); return P; }
/* How busy the groove should be: John's intensity, or Terry's slow shaping mapped onto 0–1. */
function grooveI(){ return ST.wave ? clamp(0.5 + (E.I - 0.5)*wDepth(), 0, 1) : clamp(0.5 + terryDb()/6, 0, 1); }
/* Groove evolution (0–1; 0.5 is the original setting): scales fills, ghost notes, intensity-driven density,
   phrase drift and new grooves per section. Near 0 the groove stays as the preset sets it. */
const EVO = {amount:0.5};
function evoK(){ return Math.min(1.8, EVO.amount/0.5); }
/* Each new section gets a new groove within the kit's character. */
function newGroove(){
  const K = kit(), B = TECHNO.base, r = Math.random, ri = (a, b) => a + Math.floor(r()*(b - a + 1));
  B.hat = hatPattern(ri(K.hatK[0], K.hatK[1]));
  B.perc = euclid(ri(K.percK[0], K.percK[1]), 16, ri(0, 15)).map(v => v*0.8);
  TECHNO.bassLine = makeBass(K.bass); B.bass = TECHNO.bassLine.map(x => x.v);
  const oh = r();
  B.ohat = oh < 0.55 ? [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] : oh < 0.8 ? [0,0,1,0, 0,0,1,0.5, 0,0,1,0, 0,0,1,0.5] : [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0];
  if (!K.halftime){ B.kick = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]; if (r() < 0.25) B.kick[15] = 0.5; if (r() < 0.15) B.kick[10] = 0.45; }
  if (E.started) log('New groove for the new section');
}
/* One bar of drums: the base groove, thinned or filled by intensity, with ghost notes, and a fill in the last bar of a phrase. */
function buildBar(bar){
  const K = kit(), I = grooveI(), P = cloneBar(TECHNO.base), r = Math.random;
  const ek = evoK();
  for (const k of ['hat', 'perc']) P[k] = P[k].map(v => v && v < 0.8 && r() > 1 - (1 - lerp(0.45, 1, I))*ek ? 0 : v);
  if (K.clap !== 'none' && r() < 0.6*I*ek){ const i = [3, 7, 11, 13, 15][Math.floor(r()*5)]; if (!P.clap[i]) P.clap[i] = 0.25; }
  if (r() < 0.5*I*ek){ const i = 2*Math.floor(r()*8) + 1; if (!P.hat[i]) P.hat[i] = 0.3; }
  TECHNO.fill = null;
  if (mod(bar, 8) === 7 && !E.gather && r() < Math.min(0.95, 0.6*ek)){
    const f = ['roll', 'kickdrop', 'lift', 'perc'][Math.floor(r()*4)]; TECHNO.fill = f;
    const roll = K.clap === 'none' ? 'perc' : 'clap';
    if (f === 'roll') for (let i=8;i<16;i++){ if (i >= 12 || i % 2 === 0) P[roll][i] = 0.3 + 0.07*(i - 8); }
    else if (f === 'kickdrop'){ P.kick[12] = 0; P.kick[14] = 0; P.bass = P.bass.map((v, i) => i >= 12 ? 0 : v); P.ohat[14] = 1; }
    else if (f === 'lift'){ [12, 13, 14, 15].forEach((i, k) => P.ohat[i] = 0.4 + 0.2*k); }
    else for (let i=8;i<16;i++) P.perc[i] = 0.45 + 0.06*(i - 8);
  }
  return P;
}
/* The techno form of a gathering (from 50%): calling everybody in is a breakdown (no kick, no bass, the orchestra's
   filter closes); the climax is a build (an accelerating snare roll, a noise riser, the filter opening); the dropout
   begins with the kick slamming back under a crash, and the groove carries on through the dropout and the solo. */
function technoForm(){ return TECHNO.X >= 0.5; }
function gatherPhase(){ const G = E.gather; return !G ? 'flow' : G.dropping ? 'dropout' : G.climax ? 'climax' : 'call'; }
function gateTargets(ph, x){
  const t = {kick:1, hat:1, clap:1, ohat:1, perc:1, bass:1};
  if (!technoForm()) return t;
  if (ph === 'call') return {kick:0, hat:0.6, clap:0.5, ohat:0.4, perc:0.7, bass:0};
  if (ph === 'climax') return {kick:0, hat:lerp(0.6, 1, x), clap:0, ohat:lerp(0.4, 0.9, x), perc:0.8, bass:0};
  return t;
}
function musicCutoff(ph, x){
  if (!technoForm()) return 20000;
  if (ph === 'call') return 1300;
  if (ph === 'climax') return 1300*Math.pow(15, x);
  return 20000;
}
/* At phrase boundaries the drums evolve a little: hats thin or fill, percussion shifts, the bass line varies. */
function evolveDrums(){
  const P = TECHNO.base, K = kit(), ek = evoK(), r = Math.random, chance = q => Math.random() < q*ek;   // lower evolution makes each change rarer
  if (chance(0.35)){ const k = clamp(P.hat.filter(v => v > 0).length + (r() < 0.5 ? -2 : 2), K.hatK[0], K.hatK[1]); P.hat = hatPattern(k).map((v, i, a) => a[mod(i - (r() < 0.3 ? 1 : 0), 16)]); }
  if (chance(0.4)){ const k = K.percK[0] + Math.floor(r()*(K.percK[1] - K.percK[0] + 1)); P.perc = euclid(k, 16, Math.floor(r()*16)).map(v => v*0.8); }
  if (chance(0.35)){
    if (K.bass === 'acid') TECHNO.bassLine = makeBass('acid');
    else { const i = Math.floor(r()*16); if (i % 4 !== 0){ const b = TECHNO.bassLine[i]; b.v = b.v ? 0 : 0.8; b.oct = K.bass === 'house' && r() < 0.4 ? 1 : 0; } }
    P.bass = TECHNO.bassLine.map(x => x.v);
  }
}
/* The bass line plays the root of the chord the stream is on (or its fifth, now and then), low. */
function bassMidi(tone = 0, oct = 0){
  const S = stats(); const P = S.act.length ? E.gen.pats[S.hi] : null;
  if (!P || !P.fn) return 33 + 12*oct;
  const t = mod(7*P.s, 12), kd = Math.max(0, P.f.findIndex(v => mod(v, 12) === t));
  const deg = mod(kd + FN_OFF[P.fn] + 2*tone, 7);
  let m = E.gen.midiOf(deg, P.f) - 24; while (m > 45) m -= 12; while (m < 33) m += 12;
  return m + 12*oct;
}
/* Called every pulse with its audio time. */
function technoPulse(p, t){
  // tempo glides toward its target (about 20 s for the full change)
  const target = technoPeriod();
  E.period += (target - E.period)*0.03;
  if (Math.abs(target - E.period) < 1e-4) E.period = target;
  const step = mod(p, BAR);
  if (step === 0 && p !== TECHNO.lastBar){
    TECHNO.lastBar = p;
    for (const d of DRUMS){
      const want = TECHNO.X >= d.at;
      if (want !== TECHNO.on[d.key]){ TECHNO.on[d.key] = want; if (E.started) log(`${d.label} ${want ? 'enters' : 'leaves'}`); }
    }
    if (E.gen && E.gen.epoch !== TECHNO.epochSeen){ TECHNO.epochSeen = E.gen.epoch; if (TECHNO.X >= 0.2 && EVO.amount >= 0.15) newGroove(); }
    else if (mod(p, PHRASE) === 0 && p > 0) evolveDrums();
    TECHNO.pat = buildBar(Math.floor(p/BAR));
  }
  for (const d of DRUMS){   // fade in and out over about a bar
    const goal = TECHNO.on[d.key] ? lerp(0.6, 1, smooth(d.at, d.at + 0.15, TECHNO.X)) : 0;
    TECHNO.level[d.key] += (goal - TECHNO.level[d.key])*0.08;
  }
  // the gathering, techno-style
  const ph = gatherPhase(), G = E.gather;
  const x = ph === 'climax' ? clamp((p - G.climax.start)/(G.climax.end - G.climax.start), 0, 1) : 0;
  const gt = gateTargets(ph, x);
  if (ph !== TECHNO.phase){
    if (technoForm() && ph === 'climax' && G && G.climax) riser(t, (G.climax.end - p)*E.period);
    if (technoForm() && ph === 'dropout'){ TECHNO.gate.kick = 1; TECHNO.gate.bass = 1; crash(t); }   // the kick slams back
    TECHNO.phase = ph;
  }
  for (const k in gt) TECHNO.gate[k] += (gt[k] - TECHNO.gate[k])*0.12;
  if (mlp && ctx && (p % 2 === 0)) mlp.frequency.setTargetAtTime(musicCutoff(ph, x), t, ph === 'call' ? 0.8 : 0.15);
  if (!E.audio || !ctx || !drumBus) return;
  const anyone = active().some(a => !a.resting);
  if (!anyone && !E.agents.some(a => a.mode === 'out')) return;
  const K = kit(), ts = t + (step % 2 ? K.swing*E.period : 0);   // swing delays every second sixteenth
  for (const d of DRUMS){
    const lv = TECHNO.level[d.key]*TECHNO.gate[d.key], v = TECHNO.pat[d.key][step];
    if (lv < 0.02 || !v) { if (d.key === 'bass') TECHNO.prevBass = null; continue; }
    const vel = d.gain*lv*v*(K.gains[d.key] ?? 1);
    if (vel <= 0.001) continue;
    if (d.key === 'kick'){ drumKick(ts, vel); pump(ts); }
    else if (d.key === 'hat') drumHat(ts, vel, false);
    else if (d.key === 'ohat') drumHat(ts, vel, true);
    else if (d.key === 'clap') drumBackbeat(ts, vel);
    else if (d.key === 'perc') drumPerc(ts, vel);
    else if (d.key === 'bass'){ const b = TECHNO.bassLine[step]; drumBass(ts, vel*(b.acc ? 1.25 : 1), bassMidi(b.tone, b.oct), b); }
  }
  // the build: a snare roll that speeds up through the climax, ending in thirty-seconds
  if (technoForm() && ph === 'climax' && TECHNO.level.kick > 0.05){
    const div = x < 0.35 ? 4 : x < 0.7 ? 2 : 1, v = 0.15 + 0.45*x;
    if (step % div === 0){ drumSnare(ts, v); if (x > 0.85) drumSnare(ts + E.period/2, v); }
  }
}
function drumBackbeat(t, v){ const K = kit(); if (K.clap === 'clap') drumClap(t, v); else if (K.clap === 'snare') drumSnare(t, v); else if (K.clap === 'rim') drumRim(t, v); }
function riser(t, dur){
  if (!ctx || dur <= 0.2) return;
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); n.loop = true; bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
  n.connect(bp); bp.connect(g); g.connect(drumBus); n.start(t); n.stop(t + dur + 0.1);
}
function crash(t){
  if (!ctx) return;
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); hp.type = 'highpass'; hp.frequency.value = 4500;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  n.connect(hp); hp.connect(g); g.connect(drumBus); n.start(t); n.stop(t + 1.85);
}
/* Sidechain pumping: the orchestra ducks under each kick, from 60% on. */
function pump(t){
  const depth = kit().pump*smooth(0.55, 0.75, TECHNO.X); if (depth <= 0.01 || !duck) return;
  duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(duck.gain.value, t);
  duck.gain.linearRampToValueAtTime(1 - depth, t + 0.01); duck.gain.setTargetAtTime(1, t + 0.03, 0.09);
}
let NOISE = null;
function noiseBuf(){ if (!NOISE){ const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i=0;i<n;i++) d[i] = Math.random()*2 - 1; NOISE = b; } return NOISE; }
function env(g, t, peak, dec){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); }
function drumKick(t, v){
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
  const K = kit();
  o.frequency.setValueAtTime(K.kickPitch[0], t); o.frequency.exponentialRampToValueAtTime(K.kickPitch[1], t + 0.09);
  env(g, t, v, K.kickDecay); o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + K.kickDecay + 0.03);
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), gn = ctx.createGain();
  n.buffer = noiseBuf(); hp.type = 'highpass'; hp.frequency.value = 2500; env(gn, t, 0.25*v, 0.012);
  n.connect(hp); hp.connect(gn); gn.connect(drumBus); n.start(t); n.stop(t + 0.02);
}
function drumHat(t, v, open){
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); hp.type = 'highpass'; hp.frequency.value = 7000; bp.type = 'bandpass'; bp.frequency.value = 10000*Math.min(1.2, waveBright()); bp.Q.value = 0.8;
  const dec = open ? kit().openDecay : kit().hatDecay; env(g, t, v, dec);
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(drumBus); n.start(t, Math.random()*0.5); n.stop(t + dec + 0.02);
}
function drumClap(t, v){
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 1.3;
  g.gain.setValueAtTime(0.0001, t);
  for (const k of [0, 0.011, 0.022]){ g.gain.setValueAtTime(v, t + k); g.gain.exponentialRampToValueAtTime(0.15*v, t + k + 0.009); }
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(bp); bp.connect(g); g.connect(drumBus); n.start(t, Math.random()*0.5); n.stop(t + 0.22);
}
function drumSnare(t, v){
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.9; env(g, t, v, 0.16);
  n.connect(bp); bp.connect(g); g.connect(drumBus); n.start(t, Math.random()*0.5); n.stop(t + 0.18);
  const o = ctx.createOscillator(), go = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
  env(go, t, 0.5*v, 0.08); o.connect(go); go.connect(drumBus); o.start(t); o.stop(t + 0.1);
}
function drumRim(t, v){
  const o = ctx.createOscillator(), g = ctx.createGain(), hp = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = 1250;
  hp.type = 'highpass'; hp.frequency.value = 900; env(g, t, 0.6*v, 0.035); o.connect(hp); hp.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.05);
}
function drumPerc(t, v){
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(540, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  env(g, t, v, 0.12); o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.14);
}
function drumBass(t, v, m, b = {}){
  const K = kit(), type = K.bass, f = tunedHz(m), bright = waveBright()*lerp(0.6, 1.2, smooth(0.6, 1, TECHNO.X));
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(g); g.connect(drumBus);
  const oscs = [];
  const osc = (type2, fr, amp) => { const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type2; o.frequency.value = fr; a.gain.value = amp; o.connect(a); a.connect(lp); oscs.push(o); return o; };
  let dur = E.period*0.85, cut = 300, q = 1;
  if (type === 'acid'){                     // resonant sawtooth with accents and slides
    const o = osc('sawtooth', f, 1); q = 14; cut = 280*bright;
    if (b.slide && TECHNO.prevBass){ o.frequency.setValueAtTime(TECHNO.prevBass, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); dur = E.period*1.05; }
    lp.frequency.setValueAtTime(cut*(b.acc ? 9 : 5), t); lp.frequency.exponentialRampToValueAtTime(cut, t + (b.acc ? 0.16 : 0.1));
  } else if (type === 'rumble'){            // dark, rolling low end
    osc('sine', f, 1); osc('triangle', f, 0.4); cut = 160; dur = E.period*1.6;
    lp.frequency.value = cut;
  } else if (type === 'house'){             // rounded pluck
    osc('sawtooth', f, 0.7); osc('square', f/2, 0.35); cut = 650*bright; q = 3;
    lp.frequency.setValueAtTime(cut*3, t); lp.frequency.exponentialRampToValueAtTime(cut, t + 0.12);
  } else {                                  // sub
    osc('sine', f, 1); osc('sawtooth', f, 0.25); cut = (260 + 600*smooth(0.6, 1, TECHNO.X))*bright;
    lp.frequency.setValueAtTime(cut*2.2, t); lp.frequency.exponentialRampToValueAtTime(cut, t + 0.08);
  }
  lp.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setValueAtTime(v, t + dur*0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  for (const o of oscs){ o.start(t); o.stop(t + dur + 0.03); }
  TECHNO.prevBass = f;
}
