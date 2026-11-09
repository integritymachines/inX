'use strict';
/* Presets: a starting point for each scene. Each sets the Techno amount, the club tempo, a drum kit (sounds, swing,
   pumping depth, pattern densities, bass type), the reverb, which composers play, and the largest ensemble.
   Everything stays adjustable afterwards. Club names are nods to their sound, nothing more. */
/* Mode settings beyond the sliders, set by presets: how high a gathering's climax rises (dB), how much surprise the stream
   carries (0–1: new material, how far keys may jump), whether every player locks to the 4/4 grid, and how much of
   Terry's slow level shaping is flattened out (0–1). */
const MODE_DEFAULT = {peakDb:7, surprise:0.5, gridAll:false, flatten:0};
// fixed ensembles, balanced across foundation, line and color
const STEADY_PLAYERS = ['bass','cellos','piano1','violins','flute','clarinet','marimba','harp'];
const DRIVE_PLAYERS = ['bass','cellos','timpani','piano1','piano2','violins','trumpet','sax','flute','clarinet','marimba','xylo','handperc','harp'];
const MODE = Object.assign({}, MODE_DEFAULT);
const PRESETS = {
  productive: {label:'Productive (ADHD)',       X:0.6, bpm:115, composers:[], terry:2, pulse:0.5, players:STEADY_PLAYERS, maxN:8, minN:3, gap:80, wet:0.2, john:0.5, drone:0.5, evo:0.15,
             mode:{peakDb:2, surprise:0.15, gridAll:true, flatten:0.8},
             kit:{kickDecay:0.32, kickPitch:[165, 50], hatDecay:0.03, openDecay:0.18, clap:'rim', bass:'sub', swing:0, pump:0.25, hatK:[8, 12], percK:[3, 5], elec:0.5, gains:{perc:0.8, ohat:0.7}}},
  creative: {label:'Creative (ADHD)',    X:0,   pulseMs:400, composers:['reich','glass','adams','young'], terry:7, pulse:0.2, philip:0.7, steve:0.7, maxN:16, minN:2, gap:12, wet:0.36, john:0.9, drone:0.45, evo:0.5,
             mode:{peakDb:8, surprise:0.85, gridAll:false, flatten:0}},
  focus:    {label:'Focus (ADHD)', X:0.9, bpm:128, composers:['adams'], terry:3, pulse:0.5, players:DRIVE_PLAYERS, maxN:14, minN:3, gap:10, wet:0.22, john:0.9, drone:0.5, evo:0.6,
             mode:{peakDb:8, surprise:0.4, gridAll:false, flatten:0}, ramp:{to:'productive', sec:600},
             kit:{kickDecay:0.42, kickPitch:[155, 48], hatDecay:0.045, openDecay:0.28, clap:'clap', bass:'sub', swing:0, pump:0.55, hatK:[10, 16], percK:[3, 7], elec:1, gains:{}}},
  inc:      {label:'In C (orchestra)', X:0,    pulseMs:200, composers:[],                  maxN:12, wet:0.28, john:0.7, drone:0.5, evo:0.5},
  minimal:  {label:'Minimal',          X:0.75, bpm:125, composers:['reich','glass'],       philip:0.6, steve:0.7, maxN:10, wet:0.22, john:0.6, drone:0.4, evo:0.6,
             kit:{kickDecay:0.3, kickPitch:[175, 52], hatDecay:0.028, openDecay:0.16, clap:'rim', bass:'sub', swing:0.06, pump:0.3, hatK:[7, 11], percK:[5, 7], elec:0.6, gains:{hat:0.8, perc:1.3, ohat:0.7}}},
  berghain: {label:'Berghain',         X:1,    bpm:136, composers:['adams','young'],       maxN:10, wet:0.32, john:0.8, drone:0.8, evo:0.4,
             kit:{kickDecay:0.62, kickPitch:[140, 43], hatDecay:0.035, openDecay:0.22, clap:'none', bass:'rumble', swing:0, pump:0.55, hatK:[8, 16], percK:[3, 5], elec:1, gains:{clap:0, ohat:0.8, kick:1.1}}},
  panorama: {label:'Panorama Bar',     X:0.85, bpm:124, composers:['glass','adams'],       maxN:14, wet:0.25, john:0.6, drone:0.5, evo:0.5,
             kit:{kickDecay:0.35, kickPitch:[160, 50], hatDecay:0.04, openDecay:0.3, clap:'clap', bass:'house', swing:0.16, pump:0.45, hatK:[12, 16], percK:[4, 6], elec:0.5, gains:{ohat:1.3}}},
  renate:   {label:'Wilde Renate',     X:0.7,  bpm:122, composers:['reich','glass','young'], steve:0.6, maxN:12, wet:0.3, john:0.7, drone:0.35, evo:0.7,
             kit:{kickDecay:0.3, kickPitch:[180, 55], hatDecay:0.03, openDecay:0.2, clap:'rim', bass:'sub', swing:0.12, pump:0.3, hatK:[6, 12], percK:[5, 9], elec:0.25, gains:{perc:1.4}}},
  tresor:   {label:'Tresor',           X:1,    bpm:134, composers:['adams','reich'],       steve:0.6, maxN:8, wet:0.36, john:0.8, drone:0.5, evo:0.3,
             kit:{kickDecay:0.55, kickPitch:[150, 45], hatDecay:0.03, openDecay:0.2, clap:'none', bass:'rumble', swing:0, pump:0.6, hatK:[12, 16], percK:[5, 7], elec:1, gains:{clap:0, perc:1.2, kick:1.15, ohat:0.7}}},
  kitkat:   {label:'KitKat',           X:1,    bpm:138, composers:['adams'],               maxN:12, wet:0.24, john:1, drone:0.5, evo:0.6,
             kit:{kickDecay:0.4, kickPitch:[165, 50], hatDecay:0.04, openDecay:0.3, clap:'clap', bass:'acid', swing:0, pump:0.65, hatK:[12, 16], percK:[3, 5], elec:1, gains:{ohat:1.1, bass:0.6}}},
  katerblau:{label:'Kater Blau',       X:0.7,  bpm:120, composers:['glass','reich'],       philip:0.7, steve:0.5, maxN:16, wet:0.3, john:0.6, drone:0.5, evo:0.7,
             kit:{kickDecay:0.32, kickPitch:[170, 52], hatDecay:0.035, openDecay:0.3, clap:'clap', bass:'house', swing:0.2, pump:0.35, hatK:[9, 13], percK:[5, 9], elec:0.3, gains:{perc:1.4, ohat:1.1}}},
  visionaere:{label:'Club der Visionäre', X:0.75, bpm:123, composers:['reich'],          steve:0.7, maxN:10, wet:0.2, john:0.5, drone:0.5, evo:0.6,
             kit:{kickDecay:0.28, kickPitch:[180, 54], hatDecay:0.025, openDecay:0.15, clap:'rim', bass:'sub', swing:0.1, pump:0.25, hatK:[5, 9], percK:[7, 11], elec:0.5, gains:{perc:1.1, hat:0.7, ohat:0.6}}},
  techno:   {label:'Techno',           X:1,    bpm:130, composers:['adams'],               maxN:12, wet:0.18, john:0.7, drone:0.5, evo:0.5,
             kit:{kickDecay:0.42, kickPitch:[155, 48], hatDecay:0.045, openDecay:0.28, clap:'clap', bass:'sub', swing:0, pump:0.6, hatK:[10, 16], percK:[3, 7], elec:1, gains:{}}},
  acid:     {label:'Acid',             X:1,    bpm:132, composers:['adams'],               maxN:10, wet:0.2, john:0.9, drone:0.5, evo:0.7,
             kit:{kickDecay:0.38, kickPitch:[160, 50], hatDecay:0.04, openDecay:0.25, clap:'clap', bass:'acid', swing:0.04, pump:0.5, hatK:[10, 16], percK:[3, 5], elec:1, gains:{bass:0.9, perc:0.7}}},
  house:    {label:'House',            X:0.8,  bpm:122, composers:['glass'],               maxN:16, wet:0.24, john:0.7, drone:0.5, evo:0.5,
             kit:{kickDecay:0.33, kickPitch:[165, 52], hatDecay:0.04, openDecay:0.32, clap:'clap', bass:'house', swing:0.18, pump:0.4, hatK:[8, 12], percK:[4, 6], elec:0.4, gains:{ohat:1.4}}},
  chillwave:{label:'Chillwave',        X:0.65, bpm:92,  composers:['adams','young'],       maxN:10, wet:0.5, john:0.9, drone:0.6, evo:0.3,
             kit:{kickDecay:0.45, kickPitch:[120, 45], hatDecay:0.05, openDecay:0.35, clap:'snare', bass:'sub', swing:0.1, pump:0.35, halftime:true, hatK:[6, 9], percK:[3, 4], elec:0.6, gains:{hat:0.7, perc:0.6, kick:0.85}}}
};
let PRESET_KEY = 'inc';
function applyPreset(key){
  const P = PRESETS[key]; if (!P) return;
  PRESET_KEY = key;
  TECHNO.kit = P.kit ? Object.assign({}, KIT_DEFAULT, P.kit, {gains:Object.assign({}, P.kit.gains || {})}) : null;
  if (P.bpm) TECHNO.userPeriod = 60/(4*P.bpm);
  if (P.pulseMs) TECHNO.userPeriod = P.pulseMs/1000/PPE;   // pulseMs is per eighth note
  TECHNO.bpm = bpmOf(TECHNO.userPeriod);
  for (const k in TECH_ON) setTechnique(k, P.composers.includes(k));
  if (wetGain && ctx) wetGain.gain.setTargetAtTime(P.wet, ctx.currentTime, 0.5);
  TECHNO.wet = P.wet;
  Object.assign(MODE, MODE_DEFAULT, P.mode || {});
  if (P.players) fixEnsemble(P.players); else if (FIXED) releaseEnsemble();
  RAMP = P.ramp ? {from:P, to:PRESETS[P.ramp.to], sec:P.ramp.sec, t0:null, done:false, called:false} : null;
  if (E.gen) initTechno();
  if (typeof onPresetApplied === 'function') onPresetApplied(P);
}
/* Focus: start high (fast, driving, an early full climax), then glide every setting into the steady Productive settings over the ramp's length. */
let RAMP = null;
function rampTick(){
  const R = RAMP; if (!R || R.done || !E.started) return;
  if (R.t0 === null) R.t0 = E.clock;
  const k = clamp((E.clock - R.t0)/R.sec, 0, 1), s = k*k*(3 - 2*k), A = R.from, B = R.to;
  const L = (a, b) => a + (b - a)*s;
  // the early peak: about two and a half minutes in, everybody is called in for a full climax
  if (!R.called && E.clock - R.t0 > 150 && !E.gather && !E.agents.some(x => x.mode === 'out' && !x.removed)){
    const act = active().filter(x => x.mode === 'flow'); if (act.length >= 3){ R.called = true; callGathering(act[Math.floor(Math.random()*act.length)], E.p); }
  }
  presetQuiet = true;
  TECHNO.userPeriod = 60/(4*L(A.bpm, B.bpm)); TECHNO.bpm = bpmOf(TECHNO.userPeriod); syncTempo();
  setRange('#techno', Math.round(100*L(A.X, B.X)));
  setRange('#terry', Math.round(L(A.terry, B.terry)));
  setRange('#john', Math.round(100*L(A.john, k < 1 ? 0 : B.john)));
  setRange('#gap', 2*Math.round(L(A.gap, B.gap)/2));
  setRange('#maxn', Math.round(L(A.maxN, B.maxN)));
  setRange('#evo', Math.round(100*L(A.evo, B.evo)));
  for (const f of ['peakDb', 'surprise', 'flatten']) MODE[f] = L(A.mode[f], B.mode[f]);
  if (TECHNO.kit && B.kit) for (const f of ['pump', 'kickDecay', 'hatDecay', 'elec']) TECHNO.kit[f] = L(A.kit[f], B.kit[f]);
  // the extra players of the driving start leave one by one over the second half of the ramp
  if (A.players && B.players && k >= 0.5){
    const extra = A.players.filter(x => !B.players.includes(x)), keep = Math.ceil(extra.length*(1 - (k - 0.5)/0.5));
    const want = B.players.concat(extra.slice(0, keep));
    if (!FIXED || want.length !== FIXED.length) fixEnsemble(want);
  }
  if (k >= 1){
    R.done = true; MODE.gridAll = B.mode.gridAll;
    for (const t in TECH_ON) setTechnique(t, B.composers.includes(t));
    document.querySelectorAll('[data-tech]').forEach(cb => { cb.checked = TECH_ON[cb.dataset.tech]; }); syncGrey();
    log('Focus: ramp complete, steady from here');
  }
  presetQuiet = false;
}
