'use strict';
/* Sound layer: instruments, synthesis, mix. */
/* ---------------- Instruments ---------------- */
/* 24 players. role: foundation (bass register), line (melodic middle), color (bright accents) or beat (percussive: drums, timpani, bells and woods);
   sample: the recorded instrument; synth: the stand-in voice until it has loaded; oct: register;
   pan: seat in the stereo field (left −1 … right +1), roughly orchestral. Colors group the families. */
const SECTIONS = {
  piano1:  {label:'Piano I',         role:'line', sample:'piano1',  synth:'pluck',   oct:0,  pan:-0.35, color:'#e0663a'},
  piano2:  {label:'Grand piano',     role:'line', sample:'piano2',  synth:'pluck',   oct:0,  pan:0.35,  color:'#c4532c'},
  organ:   {label:'Organ',           role:'line', sample:'organ',   synth:'reed',    oct:0,  pan:0,     color:'#a8642f', cut:1800},
  violins: {label:'Violins',         role:'line', sample:'violins', synth:'bowed',   oct:0,  pan:-0.6,  color:'#b8467a', cut:3500},
  viola:   {label:'Violas',          role:'line', sample:'viola',   synth:'bowed',   oct:0,  pan:-0.2,  color:'#9c3d8f', cut:2200},
  cellos:  {label:'Cellos',          role:'foundation', sample:'cellos',  synth:'bowed',   oct:-1, pan:0.3,   color:'#7a52cc', cut:1400},
  bass:    {label:'Double bass',     role:'foundation', sample:'bass',    synth:'bass',    oct:-2, pan:0.55,  color:'#5b45a8'},
  harp:    {label:'Harp',            role:'color', sample:'harp',    synth:'pluck',   oct:0,  pan:-0.75, color:'#d16aa8'},
  guitar:  {label:'Guitar',          role:'line', sample:'guitar',  synth:'pluck',   oct:-1, pan:0.7,   color:'#a8487a'},
  piccolo: {label:'Piccolo',         role:'color', sample:'piccolo', synth:'flute',   oct:1,  pan:-0.1,  color:'#3fb89a'},
  flute:   {label:'Flute',           role:'line', sample:'flute',   synth:'flute',   oct:0,  pan:-0.3,  color:'#22a9b0'},
  oboe:    {label:'Oboe',            role:'line', sample:'oboe',    synth:'reed',    oct:0,  pan:0.1,   color:'#2f9e6b', cut:2000},
  clarinet:{label:'Clarinet',        role:'line', sample:'clarinet',synth:'reed',    oct:0,  pan:-0.15, color:'#3a8f8f', cut:1500},
  sax:     {label:'Saxophone',       role:'line', sample:'sax',     synth:'reed',    oct:0,  pan:0.25,  color:'#5aa04a', cut:1800},
  bassoon: {label:'Bassoon',         role:'foundation', sample:'bassoon', synth:'reed',    oct:-1, pan:0.2,   color:'#4f7a3a', cut:900},
  horn:    {label:'Horn',            role:'line', sample:'horn',    synth:'brass',   oct:-1, pan:-0.45, color:'#d4a017', cut:1600},
  trumpet: {label:'Trumpet',         role:'line', sample:'trumpet', synth:'brass',   oct:0,  pan:0.4,   color:'#e8b83a', cut:3200},
  trombone:{label:'Trombone',        role:'foundation', sample:'trombone',synth:'brass',   oct:-1, pan:0.5,   color:'#b8891c', cut:1500},
  tuba:    {label:'Tuba',            role:'foundation', sample:'tuba',    synth:'bass',    oct:-2, pan:0.6,   color:'#8c6a14'},
  marimba: {label:'Marimba',         role:'color', sample:'marimba', synth:'marimba', oct:0,  pan:-0.5,  color:'#3f86c9'},
  xylo:    {label:'Xylophone',       role:'color', sample:'xylo',    synth:'xylo',    oct:1,  pan:0.45,  color:'#2f6db5'},
  glock:   {label:'Glockenspiel',    role:'color', sample:'glock',   synth:'mallet',  oct:2,  pan:-0.3,  color:'#5c6bc0'},
  timpani: {label:'Timpani',         role:'beat', sample:'timpani', synth:'bass',    oct:-1, pan:0,     color:'#6d7781'},
  handperc:{label:'Hand percussion', role:'beat', sample:'handperc',synth:'perc',    oct:0,  pan:0.15,  color:'#8a94a0'},
  // beyond the default 24, chosen in Setup (VCSL, CC0)
  congas:  {label:'Congas & bongos', role:'beat', sample:'congas',  synth:'perc',    oct:0,  pan:-0.25, color:'#b07a4f'},
  darbuka: {label:'Darbuka & frame drum', role:'beat', sample:'darbuka', synth:'perc', oct:0, pan:0.3, color:'#a0603a'},
  bells:   {label:'Bells & woods',   role:'beat', sample:'bells',   synth:'perc',    oct:0,  pan:-0.1,  color:'#c9a227'},
  harpsi:  {label:'Harpsichord',     role:'line', sample:'harpsi',  synth:'pluck',   oct:0,  pan:-0.4,  color:'#b5702d'},
  vibes:   {label:'Vibraphone',      role:'color', sample:'vibes',  synth:'mallet',  oct:0,  pan:0.35,  color:'#4f8fd6'},
  tubular: {label:'Tubular bells',   role:'color', sample:'tubular', synth:'mallet', oct:0,  pan:0.1,   color:'#7d8fd9'},
  kalimba: {label:'Kalimba',         role:'color', sample:'kalimba', synth:'pluck',  oct:1,  pan:-0.55, color:'#c47a3a'},
  mbira:   {label:'Mbira',           role:'line', sample:'mbira',   synth:'pluck',   oct:0,  pan:0.5,   color:'#9a6233'},
  balafon: {label:'Balafon',         role:'color', sample:'balafon', synth:'marimba', oct:0, pan:-0.35, color:'#7a9a3a'},
  dantranh:{label:'Đàn tranh',       role:'line', sample:'dantranh', synth:'pluck',  oct:0,  pan:0.6,   color:'#c2558a'},
  recorder:{label:'Alto recorder',   role:'line', sample:'recorder', synth:'flute',  oct:1,  pan:-0.25, color:'#33a58a'},
  harmonica:{label:'Harmonica',      role:'line', sample:'harmonica', synth:'reed',  oct:0,  pan:0.3,   color:'#6d8f3a', cut:2400},
  // synthesized instruments: no recordings; vintage synthesizers imitated with Web Audio, and a gamelan pair
  moog:    {label:'Moog bass',       role:'foundation', sample:null, synthOnly:true, synth:'bass', oct:-2, pan:0,    color:'#3d3d8f'},
  ms20:    {label:'MS-20 lead',      role:'line', sample:null, synthOnly:true, synth:'reed',  oct:0,  pan:0.2,   color:'#8f3d5c'},
  juno:    {label:'Juno pad',        role:'color', sample:null, synthOnly:true, synth:'bowed', oct:0, pan:-0.3,  color:'#3d8f8a'},
  polysix: {label:'Polysix strings', role:'line', sample:null, synthOnly:true, synth:'bowed', oct:0,  pan:0.45,  color:'#5c8f3d'},
  prophet: {label:'Prophet brass',   role:'line', sample:null, synthOnly:true, synth:'brass', oct:0,  pan:-0.45, color:'#8f6a3d'},
  m1organ: {label:'M1 organ bass',   role:'foundation', sample:null, synthOnly:true, synth:'bass', oct:-1, pan:0.1, color:'#6a3d8f'},
  saron:   {label:'Saron (gamelan)', role:'line', sample:null, synthOnly:true, synth:'mallet', oct:0, pan:-0.2,  color:'#b08a2e'},
  gender:  {label:'Gendèr (gamelan)', role:'color', sample:null, synthOnly:true, synth:'mallet', oct:0, pan:0.25, color:'#8a6d2e'}
};
for (const k in SECTIONS) SECTIONS[k].key = k;
const ROLES = ['foundation', 'line', 'color', 'beat'];
const ROLE_SHARE = {foundation:0.22, line:0.45, color:0.18, beat:0.15};   // the mix the ensemble aims for
const ROLE_DB = {foundation:-2, line:0, color:-4, beat:-2};   // where each group sits in the balance
const SYNTH_GAIN = {perc:0.6, harpsi:0.5, pluck:0.85, mallet:0.75, bowed:0.5, reed:0.45, flute:0.7, brass:0.42, bass:0.9, pulse:0.45, marimba:0.95, xylo:0.7, voice:0.55};

let ctx = null, bus = null, analyser = null, music = null, duck = null, drumBus = null, wetGain = null, mlp = null;
function initAudio(){
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  bus = ctx.createGain(); bus.gain.value = 0.75;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 2; comp.attack.value = 0.01; comp.release.value = 0.25;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  const verb = ctx.createConvolver(); verb.buffer = impulse(2.6);
  const wet = ctx.createGain(); wet.gain.value = (typeof TECHNO !== 'undefined' && TECHNO.wet) || 0.28; wetGain = wet;
  bus.connect(comp); comp.connect(lim); comp.connect(verb); verb.connect(wet); wet.connect(lim);
  analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
  lim.connect(analyser); analyser.connect(ctx.destination);
  // players → music (loudness control) → duck (sidechain) → bus; drums → drumBus → bus
  duck = ctx.createGain(); duck.connect(bus);
  mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 20000; mlp.Q.value = 0.9; mlp.connect(duck);   // the techno build's filter
  music = ctx.createGain(); music.connect(mlp);
  drumBus = ctx.createGain(); drumBus.gain.value = 0.3; drumBus.connect(bus);
}
function impulse(sec){
  const n = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c=0;c<2;c++){ const d = b.getChannelData(c); for (let i=0;i<n;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/n, 3); }
  return b;
}
const hz = m => 440*Math.pow(2, (m-69)/12);
function voice(spec, m, t, dur, vel, bright = 1, dest = null){
  const f = tunedHz(m), g = ctx.createGain(); g.connect(dest || bus);
  const oscs = []; let end;
  const O = (type, fr, det, gain, dest) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det;
    const gg = ctx.createGain(); gg.gain.value = gain; o.connect(gg); gg.connect(dest); oscs.push(o);
  };
  const LP = (fr, q=0.7) => { fr = Math.min(12000, fr*bright); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = fr; lp.Q.value = q; lp.connect(g); return lp; };
  const perc = dec => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t+0.004); g.gain.exponentialRampToValueAtTime(0.0001, t+dec); end = t+dec; };
  const sus = (att, rel) => { const h = Math.max(att, dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t+att); g.gain.setValueAtTime(vel, t+h); g.gain.linearRampToValueAtTime(0, t+h+rel); end = t+h+rel; };
  switch (spec.synth){
    case 'pluck': { const lp = LP(Math.min(8000, f*8)); lp.frequency.setValueAtTime(Math.min(12000, f*8*bright), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f*1.5), t+0.6);
      O('triangle', f, 0, 1, lp); O('sawtooth', f, 4, 0.25, lp); perc(Math.min(1.6, dur+0.5)); break; }
    case 'mallet': { O('sine', f, 0, 1, g); O('sine', f*4, 0, 0.18, g); O('sine', f*10, 0, 0.04, g); perc(spec.oct >= 2 ? 0.9 : 1.4); break; }
    case 'bowed': { const lp = LP(spec.cut || 2000); O('sawtooth', f, -7, 0.5, lp); O('sawtooth', f, 7, 0.5, lp); sus(0.09, 0.3); break; }
    case 'reed': { const lp = LP(spec.cut || 1400, 1); O('square', f, 0, 0.6, lp); O('triangle', f, 0, 0.5, lp); sus(0.03, 0.12); break; }
    case 'flute': { O('sine', f, 0, 1, g); O('triangle', f*2, 0, 0.15, g); sus(0.06, 0.15); break; }
    case 'brass': { const c = (spec.cut || 2400)*bright, lp = LP(c*0.25/bright, 1.2);
      lp.frequency.setValueAtTime(c*0.25, t); lp.frequency.linearRampToValueAtTime(c, t+0.06); lp.frequency.linearRampToValueAtTime(c*0.6, t+0.3);
      O('sawtooth', f, 0, 1, lp); O('sawtooth', f, 5, 0.4, lp); sus(0.04, 0.12); break; }
    case 'bass': { const lp = LP(700); O('triangle', f, 0, 1, lp); O('sine', f, 0, 0.6, lp); sus(0.01, 0.2); break; }
    case 'harpsi': {   // two plucked registers (8' and 4'), bright attack, quick decay
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; hp.connect(g);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(12000, f*14*bright), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f*3), t+0.35); lp.connect(hp);
      O('sawtooth', f, -3, 0.7, lp); O('square', f*2, 4, 0.25, lp); perc(Math.min(1.1, dur+0.35)); break; }
    case 'marimba': { O('sine', f, 0, 1, g); O('sine', f*4, 0, 0.1, g); O('sine', f*9.9, 0, 0.03, g); perc(0.45); break; }
    case 'xylo': { O('sine', f, 0, 1, g); O('sine', f*3, 0, 0.25, g); O('sine', f*6.27, 0, 0.08, g); perc(0.25); break; }
    case 'voice': {   // an open "ah": a sawtooth through two vowel formants, with a slight vibrato
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      f1.type = f2.type = 'bandpass'; f1.frequency.value = 750; f2.frequency.value = 1200*Math.min(1.3, bright); f1.Q.value = 6; f2.Q.value = 8;
      f1.connect(g); f2.connect(g);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f*0.006; lfo.connect(lg); lg.connect(o.frequency);
      const a1 = ctx.createGain(), a2 = ctx.createGain(); a1.gain.value = 2.2; a2.gain.value = 1.4; o.connect(a1); o.connect(a2); a1.connect(f1); a2.connect(f2);
      oscs.push(o, lfo); sus(0.12, 0.3); break; }
    case 'perc': {   // stand-in for hand percussion: a short filtered noise tap, higher for higher notes
      const n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate*0.12), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i=0;i<len;i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/len, 4);
      n.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 200 + 30*Math.max(0, m - 36); bp.Q.value = 4;
      n.connect(bp); bp.connect(g); oscs.push(n); perc(0.14); break; }
    case 'pulse': { O('sine', f, 0, 1, g); O('triangle', f*2, 0, 0.2, g); perc(0.09); break; }
  }
  for (const o of oscs){ o.start(t); o.stop(end + 0.05); }
}

