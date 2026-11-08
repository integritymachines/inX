'use strict';
/* Score layer: the evolving pattern stream. */
/* ---------------- Pattern generator ---------------- */
const FN_OFF = {I:0, ii:1, iii:2, IV:3, V:4, vi:5};
const PROG = {   // likely next chord, by function
  I:{IV:3, V:2, vi:3, ii:1, iii:1}, ii:{V:4, vi:1, IV:1, iii:1}, iii:{vi:3, IV:2, ii:1},
  IV:{I:2, V:3, ii:2, vi:1}, V:{I:4, vi:2, iii:1, IV:1}, vi:{ii:3, IV:3, V:1, iii:1, I:1}
};
class Gen {
  constructor(seed, seeds){
    this.r = mulberry32(seed >>> 0); this.seeds = seeds; this.pats = [];
    this.f = CMAJ.slice(); this.s = 0; this.trans = null;
    this.nextTransAt = seeds.length + this.newToneAt();
    this.newDir = 1;             // In C's order: the first new tone sharpens (F♯)
    this.epoch = 0; this.epochT = -1; this.boost = 0;
    this.useEx = true; this.rawHist = []; this.elite = [];
    this.mode = 'v2';            // 'v2': harmonic regions, coherence and contrast; 'v1': the earlier complexity-only selection
    this.reg = {fn:'I', left:this.ri(6, 12)};
    this.waveHint = null;        // current intensity (0–1) when Adams waves are on
    this.theme = null;           // the section's theme: its first non-plain pattern, reworked through the section
    this.openAt = seeds.length; this.themeAt = seeds.length;   // the solo opens on plain patterns [openAt, themeAt); the theme comes at themeAt
  }
  /* Section arc: 0 at the solo that opens a section, 1 where the next gathering is due (about the 'patterns between gatherings' + 6). */
  arcLen(){ return (typeof E !== 'undefined' && E.gap ? E.gap : 30) + 6; }
  arcAt(i){ return clamp((i - (this.epochT + 1))/this.arcLen(), 0, 1); }
  /* Pitch content moves the way In C's does: a section opens on a few tones of the key (1 3 4 5, like In C's C E F G), the 7th and then
     the rest of the scale join, and about halfway one new tone arrives and tips the key a fifth (sharp side first, as In C's F♯, wandering and drifting home). */
  newToneAt(){ return Math.round((0.45 + 0.15*this.r() + 0.2*(0.5 - MODE.surprise))*this.arcLen()); }   // less surprise: later
  allowedAt(i){
    if (this.mode !== 'v2') return null;
    const a = this.arcAt(i), kd = this.keyDeg();
    const rel = a < 0.12 ? [0, 2, 3, 4] : a < 0.3 ? [0, 2, 3, 4, 6] : null;
    return rel ? new Set(rel.map(r => mod(kd + r, 7))) : null;
  }
  /* ---- Harmonic regions: a slow chord progression within the key (In C's implied harmonies). ---- */
  keyDeg(){ const t = mod(7*this.s, 12); const j = this.f.findIndex(v => mod(v, 12) === t); return j < 0 ? 0 : j; }
  chordDegs(fn){ const r = mod(this.keyDeg() + FN_OFF[fn], 7); return [r, mod(r+2, 7), mod(r+4, 7)]; }
  regionStep(i){
    const forbid = this.trans ? this.trans.j : -1;
    const bad = fn => forbid >= 0 && this.chordDegs(fn).includes(forbid);
    if (this.mode === 'v2'){
      // harmony by arc: the tonic through the opening, chords moving faster toward the build, the dominant held before the climax
      const a = this.arcAt(i);
      if (a < 0.25 && !bad('I')){ this.reg.fn = 'I'; this.reg.left = 1; return; }
      if (a >= 0.8 && !bad('V')){ this.reg.fn = 'V'; this.reg.left = 1; return; }
      if (--this.reg.left > 0 && !bad(this.reg.fn)) return;
      const nxt = PROG[this.reg.fn], fns = Object.keys(nxt).filter(fn => !bad(fn));
      if (fns.length) this.reg.fn = this.wpick(fns, fns.map(fn => nxt[fn]));
      const k = clamp((a - 0.25)/0.55, 0, 1);
      this.reg.left = Math.round(lerp(this.ri(6, 10), this.ri(3, 5), k));
      return;
    }
    if (--this.reg.left > 0 && !bad(this.reg.fn)) return;
    const nxt = PROG[this.reg.fn], fns = Object.keys(nxt).filter(fn => !bad(fn));
    if (fns.length) this.reg.fn = this.wpick(fns, fns.map(fn => nxt[fn]));
    this.reg.left = this.ri(6, 12);
  }
  /* After a key change, keep the same chord and name its function in the new key. */
  reframeRegion(oldKeyDeg){
    const root = mod(oldKeyDeg + FN_OFF[this.reg.fn], 7), off = mod(root - this.keyDeg(), 7);
    this.reg.fn = Object.keys(FN_OFF).find(fn => FN_OFF[fn] === off) || 'V';
  }
  /* Coherence: how much of the pattern's weight falls on chord tones (strong beats, long notes and the first note count more). */
  coherence(c, degs){
    let w = 0, hit = 0;
    for (const n of c.notes){ const x = n.d*(n.o % 2 === 0 ? 1.5 : 1)*(n.o === 0 ? 1.5 : 1); w += x; if (degs.includes(mod(n.deg, 7))) hit += x; }
    return w ? hit/w : 0;
  }
  /* Contrast: a complexity target (0 plain … 1 intricate, mapped onto a fixed complexity scale) that moves between plain and intricate;
     about one pattern in four is a deliberately plain one. With Adams waves, the target leans on the wave. */
  target(i){
    const prev = this.pats[i-1], a = this.arcAt(i);
    if (this.mode === 'v2'){
      if (i >= this.openAt && i < this.themeAt) return {t:0.08, plain:true, a};   // the solo's plain opening
      if (i === this.themeAt) return {t:0.45, plain:false, a, theme:true};          // the section's theme: clearly interesting, not yet intricate
    }
    // plain patterns: many in the exposition, a breath before the build, almost none at the top
    const pp = a < 0.2 ? 0.35 : a < 0.6 ? 0.12 : a < 0.8 ? 0.25 : 0.05;
    if (hash32(i, 99) % 100 < pp*100 && !(prev && prev.plain)) return {t:0.08, plain:true, a};   // never two plain patterns in a row
    let t = 0.1 + 0.8*Math.pow(a, 1.3) + 0.05*Math.sin(i/3.7);    // plain and narrow at the start, intricate at the climax
    if (this.waveHint !== null) t = 0.75*t + 0.25*this.waveHint;
    return {t:clamp(t, 0.05, 0.95), plain:false, a};
  }
  rank(raw){ if (this.rawHist.length < 2) return 0.5; let b = 0; for (const r of this.rawHist) if (r < raw) b++; return b/this.rawHist.length; }
  plainOf(i, degs){
    const len = clamp(this.lenTarget(i) < 4*PPE ? 4*PPE : Math.round(this.lenTarget(i)*(0.8 + 0.4*this.r())), 4*PPE, 48*PPE), notes = [];
    const base = 7*Math.floor(this.regT(i)/7);
    const tone = () => base + this.pick(degs) + (this.r() < 0.2 ? 7 : 0);
    const kind = this.pick(['long', 'long', 'repeat', 'pair']);
    if (kind === 'long') notes.push({o:0, d:len, deg:tone()});
    else if (kind === 'repeat'){ const d = tone(), step = PPE*this.pick([2, 2, 4]); for (let o=0;o<len;o+=step) notes.push({o, d:Math.max(1, step-PPE), deg:d}); }
    else { const h = len >> 1; notes.push({o:0, d:h, deg:tone()}, {o:h, d:len-h, deg:tone()}); }
    return {len, notes, op:'new', parents:[]};
  }
  /* Excitement: mean of four normalized components, mapped onto a fixed 0–1 scale.
     nPVI of inter-onset intervals (rhythmic variability, Grabe & Low), Shannon entropy of melodic intervals,
     pitch range, note density. */
  rawOf(P){
    const on = [...new Set(P.notes.map(n => n.o))].sort((a,b) => a-b);
    const ioi = on.map((o,k) => (k+1 < on.length ? on[k+1] : on[0] + P.len) - o);
    let npvi = 0;
    if (ioi.length > 1){ for (let k=0;k<ioi.length-1;k++) npvi += Math.abs(ioi[k]-ioi[k+1])/((ioi[k]+ioi[k+1])/2); npvi = 100*npvi/(ioi.length-1); }
    const ds = P.notes.map(n => n.deg), iv = {};
    for (let k=0;k<ds.length;k++){ const d = clamp(ds[(k+1)%ds.length]-ds[k], -7, 7); iv[d] = (iv[d]||0)+1; }
    let H = 0; for (const c of Object.values(iv)){ const q = c/ds.length; H -= q*Math.log2(q); }
    const range = (Math.max(...ds) - Math.min(...ds))/9, dens = PPE*P.notes.length/P.len/1.2;   // notes per eighth
    const comps = {rhythm:clamp(npvi/100,0,1), melody:clamp(H/3,0,1), range:clamp(range,0,1), density:clamp(dens,0,1)};
    P.comps = comps;
    const size = Math.min(1, 0.2 + 0.2*P.notes.length);   // a figure of one or two notes can't be very complex, however it's measured
    return size*(0.3*comps.rhythm + 0.3*comps.melody + 0.2*comps.range + 0.2*comps.density);
  }
  rate(P){
    P.raw = this.rawOf(P);
    if (P.coh === undefined) P.coh = this.coherence(P, this.chordDegs(this.reg.fn));
    this.rawHist.push(P.raw); if (this.rawHist.length > 120) this.rawHist.shift();
    P.ex = clamp((P.raw - 0.1)/0.55, 0, 1);   // excitement on a fixed scale: plain ≈ 0, intricate ≈ 1
    const key = this.mode === 'v2' ? (x => x.coh + 0.3*x.ex) : (x => x.raw);
    if (!P.plain) this.elite.push(P); this.elite.sort((a,b) => key(b) - key(a)); if (this.elite.length > 16) this.elite.length = 16;
    return P;
  }
  ri(a,b){ return a + Math.floor(this.r()*(b-a+1)); }
  pick(arr){ return arr[Math.floor(this.r()*arr.length)]; }
  wpick(items, ws){ let t = ws.reduce((a,b)=>a+b,0)*this.r(); for (let k=0;k<items.length;k++){ t -= ws[k]; if (t <= 0) return items[k]; } return items[items.length-1]; }
  midiOf(deg, f){ return 60 + 12*Math.floor(deg/7) + f[mod(deg,7)]; }
  degOf(m){ const oct = Math.floor((m-60)/12), pc = mod(m-60,12); let best=0, bd=99; for (let j=0;j<7;j++){ const d=Math.abs(this.f[j]-pc); if (d<bd){ bd=d; best=j; } } return 7*oct+best; }
  lenT(i){ return clamp(7 + 4*Math.sin(i/41) + 2*Math.sin(i/13+1), 2, 20); }
  /* Length target, drawn per pattern from a wide, long-tailed (log-normal) spread like In C's: mostly cells of a few pulses,
     some single beats, and now and then a long, sprawling pattern. Calibrated on In C's 53 patterns: median 6 eighth-note pulses,
     log-spread 1.1 (a quarter of them an eighth note or less, a fifth 8½ quarter notes or more, the longest 32 quarters). In pulses (sixteenths). */
  lenTarget(i){
    const mix = h => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
    const u1 = (mix(hash32(i, 7)) + 1)/4294967297, u2 = mix(hash32(i, 13))/4294967296;
    const z = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
    return clamp(Math.round(6*PPE*Math.exp(1.15*z)), 2, 64*PPE);
  }
  densT(i){ return 0.55 + 0.25*Math.sin(i/29+2); }
  regT(i){ return 3 + 3*Math.sin(i/57); }
  get(i){ while (this.pats.length <= i) this.pats.push(this.make(this.pats.length)); return this.pats[i]; }

  stepField(dir){
    const T = mod(7*this.s, 12);
    const target = dir > 0 ? mod(T+5,12) : mod(T+11,12);
    const j = this.f.findIndex(v => mod(v,12) === target);
    return j;
  }
  updateField(i){
    if (this.trans && i >= this.trans.apply){
      const kd = this.keyDeg();
      this.f[this.trans.j] += this.trans.dir; this.s += this.trans.dir;
      // high surprise: now and then the key leaps two or three fifths at once instead of one (a long jump among short steps)
      if (this.mode === 'v2' && MODE.surprise > 0.6 && this.r() < (MODE.surprise - 0.6)*1.6){
        for (let x = this.ri(1, 2); x > 0; x--){ const j2 = this.stepField(this.trans.dir); if (j2 >= 0){ this.f[j2] += this.trans.dir; this.s += this.trans.dir; } }
      }
      this.reframeRegion(kd);
      this.trans = null; this.nextTransAt = this.mode === 'v2' ? Infinity : i + this.ri(20, 45);   // one new tone per section
      this.keyChangeAt = i;
    }
    if (!this.trans && i >= this.nextTransAt){
      // alternate sides as In C does, but lean back toward the home key once two or more steps away
      // keep wandering the same way more often than not, turning back toward the home key once two steps away (C → G → D → G → C → F …)
      let dir = this.r() < 0.65 ? this.newDir : -this.newDir; if (Math.abs(this.s) >= 2) dir = -Math.sign(this.s); this.newDir = dir;
      const j = this.stepField(dir);
      if (j >= 0){ this.trans = {j, dir, start:i, apply:i + Math.min(SPREAD, 3) + 1}; if (this.chordDegs(this.reg.fn).includes(j)) this.reg.left = 1; }
      else this.nextTransAt = i + 10;
    }
  }
  newEpoch(T){
    if (this.epochT === T) return false;
    this.epochT = T; this.epoch++; this.boost = 0; this.trans = null;
    this.openAt = T + 1; this.themeAt = T + 1 + this.ri(2, 3);   // the soloist opens plainly; the first interesting pattern is the theme
    this.theme = null;
    if (this.pats.length > T+1) this.pats.length = T+1;
    // the new section stays in the key the last one reached; its own new tone comes about halfway
    this.reg = {fn:'I', left:1};
    this.nextTransAt = T + 1 + this.newToneAt();
    return true;
  }
  fromSeed(i){
    const sd = this.seeds[i];
    const notes = sd.notes.map(([o,d,m]) => ({o, d, deg:this.degOf(m)}));
    return this.rate({i, len:sd.len, notes, midi:sd.notes.map(n=>n[2]), s:this.s, f:this.f.slice(), op:'seed', parents:[], forbid:-1, fast:notes.some(n => n.o % PPE || n.d % PPE)});
  }
  make(i){
    if (i < this.seeds.length) return this.fromSeed(i);
    this.updateField(i);
    this.regionStep(i);
    const forbid = (this.trans && i >= this.trans.start && i < this.trans.apply) ? this.trans.j : -1;
    const v2 = this.mode === 'v2', degs = this.chordDegs(this.reg.fn), T = this.target(i), allowed = this.allowedAt(i);
    let best = null, bs = -Infinity;
    for (let k=0;k<18;k++){
      const prop = v2 && T.plain && k % 2 === 0 ? this.plainOf(i, degs) : this.propose(i);
      if (v2 && !T.plain && k % 3 === 1) this.fitLength(prop, this.lenTarget(i));   // a third of the candidates are stretched or cut toward the length target
      this.fitPitches(prop, allowed);
      const c = this.clean(prop, forbid); if (!c) continue;
      const sc = (v2 ? this.score2(c, i, degs, T) : this.score(c, i)) + this.r()*0.05;
      if (sc > bs){ bs = sc; best = c; }
    }
    if (!best){
      const prev = this.pats[i-1];
      best = this.clean({len:prev.len, notes:prev.notes.map(n=>({...n})), op:'mut', parents:[prev.i], fast:!!prev.fast}, forbid)
          || {len:4, notes:[{o:0, d:2, deg: forbid===4 ? 2 : 4}], op:'new', parents:[]};
    }
    if (this.boost > 0) this.boost--;
    best.i = i; best.s = this.s; best.f = this.f.slice(); best.forbid = forbid;
    best.keyChange = this.keyChangeAt === i;
    best.fn = this.reg.fn; best.coh = this.coherence(best, degs); best.plain = T.plain;
    if (T.theme){ best.theme = true; this.theme = best; }
    best.midi = best.notes.map(n => this.midiOf(n.deg, this.f));
    return this.rate(best);
  }
  parent(i){
    if (this.mode === 'v2' && this.theme){                       // rework the theme: often early, less as the section develops
      const a = this.arcAt(i);
      if (this.r() < (0.5 - 0.3*a)*clamp(1.5 - MODE.surprise, 0.6, 1.4)) return this.theme;
    }
    if (this.r() < 0.07){
      if (!this.useEx) return this.pats[this.ri(0, this.seeds.length-1)];
      return this.elite[this.ri(0, this.elite.length-1)];
    }
    const c = [], ws = [];
    for (let a=1; a<=8 && i-a>=0; a++){ const p = this.pats[i-a]; if (p && !(this.mode === 'v2' && p.plain)){ c.push(p); ws.push(!this.useEx ? 1/a : this.mode === 'v2' ? Math.pow(0.4 + Math.min(p.coh || 0, 0.7), 2)/a : Math.pow(0.25 + p.ex, 2)/a); } }
    if (!c.length) return this.elite.length ? this.elite[this.ri(0, this.elite.length-1)] : this.pats[this.ri(0, this.seeds.length-1)];
    return this.wpick(c, ws);
  }
  propose(i){
    const a = this.mode === 'v2' ? this.arcAt(i) : 0.5;
    const sp = 2*MODE.surprise;                                     // surprise: 0.5 is the original amount
    const nw = this.mode !== 'v2' ? 0.15 : ((a > 0.3 && a < 0.7) ? 0.15 : 0.03)*sp;   // brand-new material mainly mid-section
    const op = this.wpick(['mut','cross','new'], this.boost>0 ? [0.3,0.3,0.4] : [0.5,0.35,nw]);
    if (op === 'new') return this.novo(i);
    const A = this.parent(i);
    if (op === 'mut'){
      const c = {len:A.len, notes:A.notes.map(n=>({...n})), op:'mut', parents:[A.i], fast:!!A.fast};
      const n = this.r() < 0.4 ? 2 : 1;
      for (let k=0;k<n;k++) this.mutate(c);
      return c;
    }
    let B = this.parent(i); if (B === A) B = this.pats[Math.max(0, i-2)] || A;
    return this.cross(A, B);
  }
  mutate(c){
    if (!c.notes.length) return;
    const N = () => c.notes[this.ri(0, c.notes.length-1)];
    const ops = [
      () => { const o = this.ri(0, c.len-1); let near = c.notes[0]; for (const n of c.notes) if (Math.abs(n.o-o) < Math.abs(near.o-o)) near = n; c.notes.push({o, d:this.pick([1,2,2,4]), deg: near.deg + this.pick([-2,-1,1,2])}); },
      () => { if (c.notes.length > 1) c.notes.splice(this.ri(0, c.notes.length-1), 1); },
      () => { N().deg += this.pick([-1,1]); },
      () => { const n = N(); n.o = clamp(n.o + this.pick([-2,-1,1,2]), 0, c.len-1); },
      () => { const n = N(); n.d = Math.max(1, n.d + this.pick([-1,1,1])); },
      () => { N().deg += this.pick([-7,7]); },
      () => { const k = this.ri(1, Math.max(1, c.len-1)); c.notes.forEach(n => n.o = (n.o+k) % c.len); },
      () => { c.len = clamp(c.len + this.pick([-4,-2,-1,1,2,4]), 1, 64*PPE); },
      () => {   // extend: the pattern grows by a varied repeat of one of its segments, a step up or down (a sequence)
        const a = this.ri(0, Math.max(0, c.len-2)), b = this.ri(a+1, c.len), sh = this.pick([-2,-1,1,2]), L = c.len;
        c.notes.filter(n => n.o >= a && n.o < b).forEach(n => c.notes.push({o:L + n.o - a, d:n.d, deg:n.deg + sh}));
        c.len = L + b - a;
      },
      () => {   // trim: keep only a window of the pattern
        if (c.len < 3) return; const w = this.ri(Math.max(1, c.len >> 2), c.len - 1), a = this.ri(0, c.len - w);
        const keep = c.notes.filter(n => n.o >= a && n.o < a + w).map(n => ({...n, o:n.o - a, d:Math.min(n.d, a + w - n.o)}));
        if (keep.length){ c.notes = keep; c.len = w; }
      },
      () => { const ds = c.notes.map(n=>n.deg).sort((a,b)=>a-b); const m = ds[ds.length>>1]; c.notes.forEach(n => n.deg = 2*m - n.deg); },
      () => { c.notes.forEach(n => n.o = Math.max(0, c.len - n.o - n.d)); },
      () => { if (c.len <= 32*PPE){ c.len *= 2; c.notes.forEach(n => { n.o *= 2; n.d *= 2; }); } },
      () => { if (c.len >= 4 && c.len % 2 === 0 && c.notes.every(n => n.o % 2 === 0)){ c.len /= 2; c.fast = true; c.notes.forEach(n => { n.o /= 2; n.d = Math.max(1, Math.round(n.d/2)); }); } }   // diminution: may bring sixteenths
    ];
    this.wpick(ops, [3,2,3,2,2,1,1,2,1,1,0.5,0.5,0.7,0.5])();
  }
  /* Move notes outside the section's current pitch set to the nearest tone inside it. */
  fitPitches(c, allowed){
    if (!allowed) return;
    for (const n of c.notes){ if (allowed.has(mod(n.deg, 7))) continue;
      for (const d of [1, -1, 2, -2]) if (allowed.has(mod(n.deg + d, 7))){ n.deg += d; break; } }
  }
  /* Stretch a candidate by sequencing its segments, or cut it to a window, until its length is near L. */
  fitLength(c, L){
    for (let g = 0; g < 5 && c.notes.length; g++){
      if (c.len < 0.8*L){
        const a = this.r() < 0.5 ? 0 : this.ri(0, Math.max(0, c.len-2)), b = Math.min(c.len, a + Math.max(1, Math.min(c.len - a, Math.round(L - c.len)))), sh = this.pick([-2,-1,0,1,2]), len0 = c.len;
        c.notes.filter(n => n.o >= a && n.o < b).forEach(n => c.notes.push({o:len0 + n.o - a, d:n.d, deg:n.deg + sh}));
        c.len = len0 + b - a;
      } else if (c.len > 1.25*L){
        const w = Math.max(1, Math.round(L)), a = this.ri(0, c.len - w);
        const keep = c.notes.filter(n => n.o >= a && n.o < a + w).map(n => ({...n, o:n.o - a, d:Math.min(n.d, a + w - n.o)}));
        if (!keep.length) return; c.notes = keep; c.len = w;
      } else return;
    }
  }
  cross(A, B){
    const kind = this.wpick(['splice','rp','set'], [0.45,0.35,0.2]);
    const cp = n => ({...n});
    let len, notes;
    if (kind === 'splice'){
      const ca = this.ri(1, Math.max(1, A.len-1)), cb = this.ri(0, Math.max(0, B.len-1));
      notes = A.notes.filter(n => n.o < ca).map(cp).concat(B.notes.filter(n => n.o >= cb).map(n => ({...n, o:n.o-cb+ca})));
      len = ca + B.len - cb;
    } else if (kind === 'rp'){
      notes = A.notes.map((n,k) => ({o:n.o, d:n.d, deg:B.notes[k % B.notes.length].deg})); len = A.len;
    } else {
      len = A.len;
      const key = n => n.o + ':' + n.deg;
      const ka = new Map(A.notes.map(n => [key(n), n]));
      const kb = new Map(B.notes.filter(n => n.o < len).map(n => [key(n), n]));
      const m = this.pick(['union','inter','xor']);
      if (m === 'union') notes = [...ka.values(), ...[...kb].filter(([k]) => !ka.has(k)).map(([,n]) => n)].map(cp);
      else if (m === 'inter') notes = [...ka].filter(([k]) => kb.has(k)).map(([,n]) => cp(n));
      else notes = [...[...ka].filter(([k]) => !kb.has(k)), ...[...kb].filter(([k]) => !ka.has(k))].map(([,n]) => cp(n));
      const cap = Math.max(1, Math.round(len*0.9));
      while (notes.length > cap) notes.splice(this.ri(0, notes.length-1), 1);
    }
    return {len, notes, op:'cross', parents:[A.i, B.i], fast:!!(A.fast || B.fast)};
  }
  novo(i){
    const len = clamp(Math.round(this.lenTarget(i)*(0.8 + 0.4*this.r())), 1, 64*PPE);
    let deg = Math.round(this.regT(i)) + this.ri(-2,2);
    const fast = len <= 8*PPE && (this.r() < 0.5 || len <= 3*PPE);                // a sixteenth-note cell, or eighths and longer
    const notes = []; let o = this.r() < 0.3 ? this.pick([1, PPE]) : 0;
    while (o < len){
      if (this.r() < 0.22){ o += fast ? 1 : PPE; continue; }
      const d = Math.min(fast ? this.pick([1,1,1,2]) : PPE*this.pick([1,1,1,2,2,3,4]), len-o);
      notes.push({o, d, deg}); o += d;
      deg += this.pick([-2,-1,-1,0,1,1,2,3,-3]);
    }
    return {len, notes, op:'new', parents:[], fast};
  }
  clean(c, forbid){
    // The eighth-note grid holds: every pattern lasts whole eighths, and only 'fast' patterns (sixteenth-note cells) use the sixteenths in between
    const q = v => PPE*Math.round(v/PPE), fast = !!c.fast && c.len <= 8*PPE;   // as in In C, sixteenths live in short cells
    const len = clamp(q(c.len), PPE, 64*PPE);
    const seen = new Set(), on = new Map(), out = [];
    for (const n0 of c.notes.slice().sort((a,b) => a.o-b.o || a.deg-b.deg)){
      const n = fast ? {o:Math.round(n0.o), d:Math.max(1, Math.round(n0.d)), deg:Math.round(n0.deg)} : {o:q(n0.o), d:Math.max(PPE, q(n0.d)), deg:Math.round(n0.deg)};
      if (n.o < 0 || n.o >= len) continue;
      while (n.deg < -8) n.deg += 7;
      while (n.deg > 15) n.deg -= 7;
      if (forbid >= 0 && mod(n.deg,7) === forbid) continue;
      n.d = Math.min(n.d, len);
      const k = n.o + ':' + n.deg; if (seen.has(k)) continue; seen.add(k);
      const cnt = on.get(n.o) || 0; if (cnt >= 2) continue; on.set(n.o, cnt+1);
      out.push(n);
    }
    if (!out.length) return null;
    return {len, notes:out, op:c.op, parents:c.parents, fast};
  }
  dist(a, b){
    const J = (x, y) => { const X = new Set(x), Y = new Set(y); let k = 0; for (const v of X) if (Y.has(v)) k++; const u = X.size + Y.size - k; return u ? k/u : 1; };
    return 0.4*(1 - J(a.notes.map(n=>n.o), b.notes.map(n=>n.o)))
         + 0.4*(1 - J(a.notes.map(n=>n.deg), b.notes.map(n=>n.deg)))
         + 0.2*Math.abs(a.len-b.len)/Math.max(a.len, b.len);
  }
  score(c, i){
    let s = 0;
    const P = c.parents.length ? this.pats[c.parents[0]] : this.pats[i-1];
    if (P && this.boost <= 0) s -= 2*Math.abs(this.dist(c, P) - 0.35);
    let minD = 1;
    for (let a=1; a<=30 && i-a>=0; a++){ const p = this.pats[i-a]; if (p) minD = Math.min(minD, this.dist(c, p)); }
    if (minD < 0.08) s -= 1;
    const lt = this.lenT(i); s -= 0.8*Math.abs(c.len - lt)/lt;
    s -= 0.8*Math.abs(c.notes.length/c.len - this.densT(i));
    const md = c.notes.reduce((a,n) => a+n.deg, 0)/c.notes.length; s -= 0.5*Math.abs(md - this.regT(i))/7;
    let leap = 0; for (let k=1;k<c.notes.length;k++) leap += Math.max(0, Math.abs(c.notes[k].deg - c.notes[k-1].deg) - 3);
    s -= 0.15*leap;
    return s;
  }
  /* v2 selection: coherence with the current chord, complexity near the contrast target, continuity with the parent. */
  score2(c, i, degs, T){
    let s = 0;
    const P = c.parents.length ? this.pats[c.parents[0]] : this.pats[i-1];
    if (P && this.boost <= 0 && !T.plain) s -= 1.5*Math.abs(this.dist(c, P) - 0.3);
    let minD = 1;
    for (let a=1; a<=30 && i-a>=0; a++){ const p = this.pats[i-a]; if (p) minD = Math.min(minD, this.dist(c, p)); }
    if (minD < 0.08) s -= 1;
    s += 1.8*Math.min(this.coherence(c, degs), 0.7);           // chord tones are favored, not enforced
    if (!T.plain){                                               // a single pitch is for plain patterns only
      const pitches = new Set(c.notes.map(n => n.deg)).size;
      if (pitches <= 1) s -= 1.5; else if (pitches === 2 && c.len >= 6*PPE) s -= 0.4;
    }
    s -= 7*Math.abs(this.rawOf(c) - (0.12 + 0.55*T.t));          // complexity near the target, on a fixed scale
    if (this.theme && !T.plain) s -= 1.2*Math.max(0, this.dist(c, this.theme) - 0.45);   // stay recognizably related to the section's theme
    s -= 1.0*Math.abs(Math.log(c.len/this.lenTarget(i)));          // length near this pattern's drawn target
    const md = c.notes.reduce((a,n) => a+n.deg, 0)/c.notes.length; s -= 0.5*Math.abs(md - this.regT(i))/7;
    let leap = 0; for (let k=1;k<c.notes.length;k++) leap += Math.max(0, Math.abs(c.notes[k].deg - c.notes[k-1].deg) - 3);
    s -= 0.2*leap;
    return s;
  }
  prune(lo){ for (let k = this.seeds.length; k < lo-60; k++) this.pats[k] = null; }
}

