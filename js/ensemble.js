'use strict';
/* Ensemble layer: players, the In C rules, gatherings, the roster. */
/* ---------------- Ensemble engine ---------------- */
const E = {
  p:0, period:0.1, clock:0, nextT:0, running:false, started:false, audio:true,
  agents:[], slots:[], gen:null, nextId:1, log:[], cycles:0, lastT:0, gather:null,
  minN:2, maxN:12, excite:true, genMode:'v2', traffic:0.5, leaseMid:200, gap:30, pulseLevel:0.5, joinCooldown:0,
  seeds:null, seedNum:1964, flags:{}
};
function log(msg){ E.log.unshift({t:E.clock, msg}); if (E.log.length > 60) E.log.length = 60; }
function once(key, msg){ if (E.flags[key]) return; E.flags[key] = true; log(msg); }

function makeAgent(manual, sec, idx, entryP){
  return {id:E.nextId++, manual, sec, idx, reps:0, minReps:2, nextStart:entryP, resting:true, restUntil:entryP, skip:true,
    mode:'flow', T:0, lastT:E.lastT, octUp:false, swOct:false, fade:1,
    leaseEnd:Infinity, leaving:false, removed:false, silenceSeen:null, silenceWait:0, soloSeen:null, soloWait:0,
    curStart:entryP, curLen:1, slot:null, rate:1, glass:null,
    pace:Math.exp(0.45*(Math.random() + Math.random() + Math.random() - 1.5)*2)};   // some players linger, some press on (about ×0.5–×2 dwell)
}
const STAY = {sec:60};   // average seconds on a pattern (set by the 'Stay per pattern' slider)
function setMinReps(a){ const P = E.gen.get(a.idx); const k = E.excite ? 0.45 + 1.1*P.ex : 1; a.minReps = Math.max(1, Math.round((a.pace || 1)*k*(STAY.sec/E.period)*(0.6 + 0.8*Math.random())/P.len)); }
function active(){ return E.agents.filter(a => a.mode !== 'out' && !a.removed); }
function stats(){
  const act = active(); const ix = act.map(x => x.idx).sort((x,y) => x-y);
  return {act, lo:ix[0], hi:ix[ix.length-1], med:ix[ix.length>>1]};
}
function name(a){ return SECTIONS[a.sec].label; }

function advance(a){
  a.idx++; a.reps = 0; setMinReps(a);
  if (Math.random() < ST.octaveProb*(ST.wave ? ST.wave.octave : 1)) a.octUp = waveOctaveUp(a) && SECTIONS[a.sec].oct < 2;
}
function leave(a, why){
  if (phaseActive(a)) endPhase(E.p, null);
  a.removed = true;
  if (why) log(`${name(a)} ${why}`);
}
function boundary(a, p){
  if (a.leaving){ leave(a, 'leaves'); return; }
  flowStep(a, p, stats());
}
function normalAdvance(a, S){
  const ahead = a.idx - S.lo, behind = S.hi - a.idx;
  if (ahead >= SPREAD) return false;
  if (behind >= SPREAD) return true;
  // each player keeps its own pace; the pull toward the middle weakens as Terry allows a wider span
  const x = 1.1*(a.reps - a.minReps) - 0.9*Math.min(1, 2/SPREAD)*(a.idx - S.med);
  return Math.random() < 1/(1 + Math.exp(-x));
}
function flowStep(a, p, S){
  if (a.fade < 1 && !(E.gather && E.gather.dropping)) a.fade = Math.min(1, a.fade + 0.1);
  if (E.phase && !ST.phase) endPhase(p, 'Phasing stops');
  if (phaseActive(a)){ if (a === E.phase.fol) phaseStep(a, p); return; }   // the pair holds its pattern while phasing
  if (ST.wave && Math.random() < 0.12) a.octUp = waveOctaveUp(a) && SECTIONS[a.sec].oct < 2;   // register follows the wave
  if (a.glass && !ST.glass) a.glass = null;
  if (a.glass){ glassStep(a); return; }                                     // holds its pattern while it grows and shrinks
  const G = E.gather;
  if (G && G.dropping){ if (dropStep(a, p)) return; }
  if (!G){
    const since = a.idx - a.lastT;
    const haz = since < E.gap ? 0 : Math.min(0.4, (0.01 + 0.08*(since - E.gap)/E.gap)*waveHazard());
    if (Math.random() < haz){ callGathering(a, p); }
  }
  if (!E.gather && maybeStartPhase(a, S)) return;
  if (normalAdvance(a, S)){ advance(a); if (!E.gather && maybeStartGlass(a)) return; }
  const playing = S.act.filter(x => !x.resting).length;
  if (!E.gather && playing > 2 && Math.random() < (ST.restBase + 0.03*S.act.length/12)*waveRestScale()){
    a.resting = true; a.skip = true; a.restUntil = snapUp(p + PPE*(4 + Math.floor(Math.random()*20*waveRestScale())));
  }
}
/* A gathering: one player calls everybody in; the whole ensemble, each on its own pattern,
   crescendos together; then all but one drop out and the next section begins. */
function callGathering(a, p){
  if (E.phase) endPhase(p, null);
  for (const x of E.agents){ x.glass = null; if (x.leaving && !x.userLeave) x.leaving = false; }
  E.gather = {caller:a.id, recruitBy:E.clock + ST.recruitSec, climax:null, dropping:false, soloist:null};
  let n = 0;
  {
    let room = E.maxN - active().length - E.slots.filter(sl => sl.waitUntil !== null && !sl.agent).length;
    for (const x of E.agents) if (x.mode === 'out' && !x.removed){   // players still sitting out since the solo come first
      x.callAt = room > 0 ? p + Math.round((1 + Math.random()*(ST.recruitSec - 8))/E.period) : null; if (room > 0){ n++; room--; } }
    const idle = E.slots.filter(sl => !sl.agent && sl.waitUntil === null && !sl.userOff && (!FIXED || FIXED.includes(sl.sec)));
    while (room > 0 && idle.length){
      const sl = pickByRole(idle); idle.splice(idle.indexOf(sl), 1);
      sl.manual = false; sl.waitUntil = E.clock + 2 + Math.random()*(ST.recruitSec - 8); n++; room--;
    }
  }
  log(`${name(a)} calls everybody in` + (n ? ` (${n} more players are coming)` : ''));
}
/* Runs every pulse while a gathering is on. */
function gatherTick(p){
  const G = E.gather; if (!G) return;
  const act = active();
  if (!G.climax){
    const pending = E.slots.some(sl => sl.waitUntil !== null && !sl.agent) || E.agents.some(x => x.mode === 'out' && !x.removed && x.callAt != null);
    const settling = act.some(x => x.resting && x.restUntil > p);
    if ((!pending && !settling) || E.clock >= G.recruitBy){
      for (const sl of E.slots) if (sl.waitUntil !== null && !sl.agent) sl.waitUntil = null;
      for (const x of E.agents) x.callAt = null;
      const ex = act.reduce((s, x) => s + E.gen.get(x.idx).ex, 0)/Math.max(1, act.length);
      const sec = E.excite ? lerp(ST.climaxSec[0], ST.climaxSec[1], ex) : (ST.climaxSec[0] + ST.climaxSec[1])/2;
      G.climax = {start:p, end:p + Math.round(sec/E.period)};
      for (const x of act){ x.swOct = false; x.resting = false; }
      log(`All ${act.length} players in: crescendo for ${Math.round(sec)} s`);
    }
    return;
  }
  if (!G.dropping && p >= G.climax.end){
    G.dropping = true;
    const manual = act.filter(x => x.manual), pool = manual.length ? manual : act;
    if (pool.length) G.soloist = pool[Math.floor(Math.random()*pool.length)].id;
    const span = Math.round((ST.dropoutSec[0] + Math.random()*(ST.dropoutSec[1] - ST.dropoutSec[0]))/E.period);
    const others = act.filter(x => x.id !== G.soloist).sort(() => Math.random() - 0.5);
    G.dropFrom = p; G.dropTo = p + span;
    others.forEach((x, k) => { x.dropStart = p; x.dropAt = p + Math.round(span*(k + 0.5 + 0.4*(Math.random() - 0.5))/Math.max(1, others.length)); });
    log('Climax reached: dropout');
  }
  if (G.dropping){
    const solo = act.find(x => x.id === G.soloist);
    if (!solo && act.length){ G.soloist = act[Math.floor(Math.random()*act.length)].id; return; }
    if (solo && act.length === 1) goSolo(solo, p);
    if (!act.length) E.gather = null;
  }
}
/* At a boundary during the drop. Returns true if the player left. */
function dropStep(a, p){
  const G = E.gather;
  if (a.id === G.soloist){ a.fade = Math.max(0.6, 1 - 0.4*clamp((p - G.dropFrom)/Math.max(1, G.dropTo - G.dropFrom), 0, 1)); return false; }
  if (p >= a.dropAt){
    if (phaseActive(a)) endPhase(p, null);
    if (a.manual || E.clock < a.leaseEnd){ a.mode = 'out'; a.soloWait = PPE*(60 + Math.floor(Math.random()*140)); a.soloSeen = null; a.themeSeen = null; }
    else leave(a, null);
    return true;
  }
  a.fade = Math.max(0.35, 1 - 0.65*Math.pow((p - a.dropStart)/Math.max(1, a.dropAt - a.dropStart), 1.5));   // fade gently on the way out
  return false;
}
function goSolo(a, p){
  waveTrough();
  const T = a.idx;
  if (E.gen.newEpoch(T)) E.cycles++;
  E.gather = null; if (PENDING_STYLE) applyStyle(PENDING_STYLE, true);
  for (const x of E.agents) if (x.mode === 'out') x.T = T;
  a.idx = T+1; a.reps = 0; setMinReps(a);
  a.fade = Math.max(a.fade, 0.5); a.lastT = T+1; E.lastT = T+1; a.octUp = false; a.resting = false;
  log(`${name(a)} plays on alone into section ${E.gen.epoch + 1} (${keyName(E.gen.s)})`);
}
/* Players who sat out the drop come back once the solo has had its moment. */
function outStep(a, p){
  if (E.gather){ if (!E.gather.climax && a.callAt != null && p >= a.callAt){ a.callAt = null; reenter(a, p); } return; }
  if (!a.manual && E.clock >= a.leaseEnd){ leave(a, null); return; }
  const act = active();
  if (!act.length){ reenter(a, p); return; }
  if (a.soloSeen == null) a.soloSeen = p;
  let due;
  if (act.length === 1){
    // the solo: once the soloist is on its last plain pattern, the first player back comes in on the theme
    const sol = act[0];
    due = (sol.idx >= E.gen.themeAt - 1 && sol.reps >= 2 && Math.random() < 0.04/PPE) || p - a.soloSeen >= 300*PPE + a.soloWait;   // fallback if the theme never comes
  } else due = act.length < arcCap() && Math.random() < 0.01/PPE;   // then one by one, as the section's arc allows
  if (due && act.length < E.maxN) reenter(a, p);
}
/* How many players the section's arc allows: the minimum at its start, rising to about four fifths of the maximum when a gathering
   is due; the gathering itself calls in the rest. Players you switch on yourself don't count against it. */
function arcCap(){
  const S = stats(); if (!S.act.length) return E.maxN;
  const a = E.gen.arcAt(S.med), top = Math.max(E.minN, Math.round(0.8*E.maxN));
  return Math.max(E.minN, Math.round(E.minN + (top - E.minN)*Math.pow(a, 1.2)));
}
function reenter(a, p){
  const S = stats();
  a.mode = 'flow'; a.idx = S.act.length ? Math.max(a.T + 1, E.gen.themeAt, S.med) : Math.max(a.T + 1, E.lastT); a.reps = 0;
  if (S.act.length && a.idx > S.lo + SPREAD - 1) a.idx = Math.max(a.T + 1, S.med);
  E.gen.get(a.idx); setMinReps(a);
  a.fade = 0.6; a.lastT = E.lastT; a.octUp = false;
  a.resting = false; a.skip = true; a.nextStart = snapUp(p + 1);
}
function climaxX(pn){ const C = E.gather && E.gather.climax; return C && !E.gather.dropping ? clamp((pn - C.start)/(C.end - C.start), 0, 1) : null; }
function climaxDbAt(x){ return ST.climaxDb[0] + (MODE.peakDb - ST.climaxDb[0])*Math.pow(Math.min(1, x/0.7), 1.3); }   // reached at 70%, then held
function gainOf(a, pn){
  let g = a.fade;
  const G = E.gather, x = climaxX(pn);
  if (x !== null) g *= Math.pow(10, climaxDbAt(x)/20);   // the whole ensemble crescendos, then holds the peak
  else if (G && G.dropping && G.dropTo){
    // the dropout starts at the peak: leaving players keep it while they fade; the soloist eases back to normal by the end
    const d = a.id === G.soloist ? MODE.peakDb*(1 - clamp((pn - G.dropFrom)/Math.max(1, G.dropTo - G.dropFrom), 0, 1)) : MODE.peakDb;
    g *= Math.pow(10, d/20);
  }
  return g;
}
function play(a, q, tq){
  let P = glassView(a, E.gen.get(a.idx));
  a.reps++; a.curStart = q; a.curLen = repLength(a, strictGrid(a) ? pow2len(P.len) : P.len); a.nextStart = q + a.curLen;
  a.filled = Math.random() < waveFill();
  const cx = climaxX(Math.round(q));
  if (cx !== null && cx > 0.55 && !a.swOct){ a.swOct = true; if (Math.random() < 0.4 && SECTIONS[a.sec].oct < 2) a.octUp = true; }
  if (a.filled) P = fillNotes(P);
  if (!E.audio || !ctx) return;
  const wg = formGain(), br = waveBright();
  const spec = SECTIONS[a.sec], sh = 12*(spec.oct + (a.octUp ? 1 : 0)), per = perPulse(a);
  for (let k=0;k<P.notes.length;k++){
    const n = P.notes[k];
    const g = gainOf(a, Math.round(q) + n.o)*wg*(a.filled && !n.acc ? 0.8 : 1);
    playNote(a.sec, clamp(P.midi[k] + sh, 24, 108), tq + n.o*per, n.d*per*(a.filled ? 0.7 : 0.92), g, br);
  }
}
function pulsePitch(S){
  if (!S.act.length) return null;
  const pats = []; for (let i=S.lo;i<=S.hi;i++){ const P = E.gen.pats[i]; if (P) pats.push(P); }
  const top = E.gen.pats[S.hi]; if (!top) return null;
  const tonic = mod(7*top.s, 12);
  const sets = pats.map(P => new Set(P.f.filter((v,j) => j !== P.forbid).map(v => mod(v,12))));
  for (const c of [tonic, mod(tonic+7,12), mod(tonic+4,12)]) if (sets.every(s => s.has(c))) return 84 + c - (c > 6 ? 12 : 0);
  return null;
}

/* ---------------- Roster: fixed slots that players float in and out of ----------------
   Players you switch on stay until you switch them off. Simulated visitors keep theirs for a lease.
   Outside the solo after a gathering, the ensemble never drops below a minimum size: leases don't end below it,
   and simulated visitors fill any gap. */
/* A mode can fix the ensemble: the listed players come in and stay (no lease), simulated visitors stay away, and a
   gathering calls in only the fixed players. Leaving such a mode hands the fixed players back to ordinary leases. */
let FIXED = null;
/* Change the line-up on stage while playing: kept instruments keep their players, new ones get empty slots,
   and players whose instrument is taken off finish their pattern and leave. */
function setRoster(list){
  ROSTER = list.slice(); ST.roster = list.slice();
  if (!E.slots || !E.slots.length) return;
  const old = E.slots;
  E.slots = list.map((sec, i) => { const s = old.find(x => x.sec === sec); if (s){ s.i = i; return s; } return {i, sec, agent:null, waitUntil:null, userOff:false, manual:false}; });
  for (const s of old) if (!list.includes(s.sec)){ const a = s.agent; if (a && !a.removed){ if (a.mode === 'out') a.removed = true; else a.leaving = true; } }
  if (typeof buildRoster === 'function' && E.started) buildRoster();
}
function fixEnsemble(list){
  // a preset's line-up must be on stage: swap in any missing instrument in place of one the preset doesn't use
  const missing = list.filter(x => !ST.roster.includes(x));
  if (missing.length){ const r = ST.roster.slice(); for (const m of missing){ for (let j = r.length - 1; j >= 0; j--) if (!list.includes(r[j])){ r[j] = m; break; } } setRoster(r); if (typeof syncSetup === 'function') syncSetup(); }
  FIXED = list.slice(); let k = 0;
  for (const s of E.slots){
    const a = s.agent && !s.agent.removed ? s.agent : null;
    if (list.includes(s.sec)){
      s.userOff = false; s.fixed = true;
      if (a){ a.manual = true; a.leaseEnd = Infinity; if (!a.userLeave) a.leaving = false; }
      else if (s.waitUntil === null){ s.manual = true; s.waitUntil = Math.max(E.clock, E.openUntil || 0) + (k++ === 0 ? 0.2 : 2 + 4*k*Math.random()); }
    } else {
      s.fixed = false;
      if (a){ if (a.mode === 'out') a.removed = true; else a.leaving = true; }
      if (s.waitUntil !== null && !a){ s.waitUntil = null; s.manual = false; }
    }
  }
}
function releaseEnsemble(){
  FIXED = null;
  for (const s of E.slots){ if (!s.fixed) continue; s.fixed = false;
    const a = s.agent; if (a && !a.removed && a.manual && !a.userSet){ a.manual = false; a.leaseEnd = E.clock + E.leaseMid*(0.5 + Math.random()); } }
}
function initSlots(){ E.slots = ST.roster.map((sec, i) => ({i, sec, agent:null, waitUntil:null, userOff:false, manual:false})); }
function slotState(s){
  if (s.waitUntil !== null && !s.agent) return 'waiting';
  const a = s.agent; if (!a) return 'off';
  if (a.mode === 'out') return 'sitting out';
  if (a.leaving) return 'leaving';
  const G = E.gather;
  if (G && G.dropping) return a.id === G.soloist ? 'soloist' : 'dropping out';
  if (G && G.climax) return 'climax';
  if (G) return a.resting ? 'rest' : 'called in';
  if (a.resting) return 'rest';
  if (a.glass) return glassLabel(a);
  if (phaseActive(a)) return a === E.phase.fol ? `phasing +${E.phase.shift}${E.phase.stage === 'drift' ? '…' : ''}` : 'phase partner';
  return 'playing';
}
function slotIsOn(s){ const st = slotState(s); return st !== 'off' && st !== 'leaving'; }
function toggleSlot(s){
  const a = s.agent;
  if (s.waitUntil !== null && !a){ s.waitUntil = null; s.userOff = true; return; }
  if (a){
    if (a.leaving){ a.leaving = false; a.userLeave = false; s.userOff = false; a.manual = true; return; }
    s.userOff = true;
    if (a.mode === 'out'){ a.removed = true; return; }
    a.leaving = true; a.userLeave = true; return;
  }
  s.userOff = false; s.manual = true; s.userSet = true; s.waitUntil = E.clock + 1 + Math.random()*2;
}
function canJoin(){
  const G = E.gather;
  if (G && G.climax) return false;
  if (E.clock < (E.openUntil || 0)) return false;   // the opening: pulse alone
  if (E.agents.some(x => x.mode === 'out' && !x.removed) && active().length === 1) return false;   // the solo
  return true;
}
function spawnInto(s){
  const S = stats();
  const idx = S.act.length ? S.med : Math.max(0, E.lastT);   // nobody playing: start where the ensemble last was (pattern 0 at the start), not at the preview's end
  const a = makeAgent(s.manual, s.sec, idx, snapUp(E.p + 1 + Math.floor(Math.random()*3)));
  E.gen.get(a.idx); setMinReps(a); a.lastT = E.lastT; a.slot = s;
  a.leaseEnd = s.manual ? Infinity : E.clock + E.leaseMid*(0.5 + Math.random());
  if (s.userSet){ a.userSet = true; s.userSet = false; }
  E.agents.push(a); s.agent = a; s.waitUntil = null; s.manual = false;
  log(`${name(a)} joins on pattern ${a.idx}${a.userSet ? ' (you)' : ''}`);
}
function manageSlots(){
  // the opening lasts at least 12 s and until the samples are in (at most 45 s more); every entry waiting for it moves along
  if (E.openUntil && E.clock >= E.openUntil && !E.samplesReady && E.clock < E.openStart + 57){
    const dt = 5*E.period; E.openUntil += dt;
    for (const s of E.slots) if (s.waitUntil !== null) s.waitUntil += dt;
  }
  rampTick();
  const now = E.clock, dt = 5*E.period;
  const act = active();
  for (const s of E.slots){
    if (s.agent && s.agent.removed) s.agent = null;
    const a = s.agent;
    if (a && !a.manual && !a.leaving && !E.gather && now > a.leaseEnd && a.mode === 'flow' && act.length > E.minN) a.leaving = true;
    if (s.waitUntil !== null && !s.agent && now >= s.waitUntil && canJoin()){
      const live = active().length;   // players still finishing their last repetition count too
      if (live < E.maxN) spawnInto(s);
      else if (s.manual){   // at the cap: a simulated visitor makes room for a player you switched on
        const v = active().find(x => !x.manual && !x.leaving);
        if (v) v.leaving = true;
      } else s.waitUntil = null;
    }
  }
  // simulated traffic: a slow random walk with occasional bursts; visitors arrive at random, up to V at a time
  E.traffic += (Math.random() - 0.5)*0.06*Math.sqrt(dt) + 0.004*dt*(0.5 - E.traffic);
  if (Math.random() < 0.0015*dt) E.traffic += 0.35 + Math.random()*0.3;
  E.traffic = clamp(E.traffic, 0, 1);
  const free = E.slots.filter(s => !s.agent && s.waitUntil === null);
  const busy = E.slots.filter(s => (s.agent && !s.agent.manual) || (s.waitUntil !== null && !s.manual)).length;
  const inSolo = E.agents.some(x => x.mode === 'out' && !x.removed);
  const coming = E.slots.filter(s => s.waitUntil !== null && !s.agent).length;
  const short = !E.gather && !inSolo && act.filter(x => !x.leaving).length + coming < E.minN;
  const room = act.length + coming < Math.min(E.maxN, arcCap());   // simulated visitors also wait for the arc
  if (!FIXED && !E.gather && !inSolo && room && act.length >= 2 && free.length){
    const {cnt} = roleNeed();
    const missing = ROLES.filter(r => cnt[r] === 0);
    if (missing.length && now >= (E.roleFillAt || 0)){
      const cand = free.filter(s => missing.includes(SECTIONS[s.sec].role));
      if (cand.length){ const s = cand[Math.floor(Math.random()*cand.length)]; s.manual = false; s.waitUntil = now + 1 + Math.random()*3; E.roleFillAt = now + 4; }
    }
  }
  if (!FIXED && free.length && room && (short || (now >= E.joinCooldown && Math.random() < E.traffic*E.maxN/E.leaseMid*dt*1.1))){
    const s = pickByRole(free);
    s.manual = false; s.waitUntil = now + (short && !act.length ? 0.2 : 1 + Math.random()*2);
    E.joinCooldown = now + 1;
  }
  updateTuning();
  droneTick();
  applyDynamics();
}
function pulse(t){
  const p = E.p;
  if (p % 5 === 0) manageSlots();
  formStep(E.period);
  gatherTick(p);
  dynamicsStep();
  technoPulse(p, t);
  const opening = E.clock < (E.openUntil || 0);
  const pulseFade = opening ? 1 : 1 - smooth(0.3, 0.45, TECHNO.X);   // the hats take over from the pulse
  if (E.audio && ctx && E.pulseLevel > 0 && pulseFade > 0.01 && p % PPE === 0){   // the pulse stays in eighth notes
    const S = stats();
    if (opening || S.act.some(x => !x.resting)){ const m = opening ? 84 : pulsePitch(S); if (m !== null) voice({synth:'pulse'}, m, t, E.period*PPE*0.5, 0.13*SYNTH_GAIN.pulse*0.55*pulseFade*Math.pow(E.pulseLevel/0.5, 1.5), 1, music); }   // pulse level: 50% is the original; 100% about +4.5 dB
  }
  for (const a of E.agents.slice()){
    if (a.removed) continue;
    if (a.mode === 'out'){ outStep(a, p); continue; }
    let guard = 0;
    while (!a.removed && a.mode !== 'out' && a.nextStart < p + 1 - EPS && guard++ < 3){
      if (a.resting){ if (a.nextStart < a.restUntil - EPS){ a.nextStart = a.restUntil; continue; } a.resting = false; }
      if (a.skip) a.skip = false;
      else {
        boundary(a, p);
        if (a.removed || a.mode === 'out') break;
        if (a.resting){ a.nextStart = a.restUntil; continue; }
        if (a.nextStart >= p + 1 - EPS){ a.skip = true; continue; }   // a snap moved the start into the next pulse
      }
      const q = Math.max(p, a.nextStart);
      if (strictGrid(a) && Math.abs(q - 4*Math.round(q/4)) > EPS){   // foundation players wait for the next beat
        a.resting = true; a.skip = true; a.restUntil = Math.ceil(q/4)*4; a.nextStart = a.restUntil; continue;
      }
      play(a, q, pulseTimeOf(q, p, t));
    }
  }
  E.agents = E.agents.filter(a => !a.removed);
  for (const s of E.slots) if (s.agent && s.agent.removed) s.agent = null;
  if (p % 64 === 0){ const S = stats(); if (S.act.length) E.gen.prune(S.lo); }
  E.p++; E.clock += E.period;
}

function parseSeeds(text){
  const data = JSON.parse(text);
  if (!Array.isArray(data) || !data.length) throw new Error('Expected a non-empty JSON array of patterns.');
  return data.map((s, k) => {
    if (!s || !Number.isFinite(s.len) || s.len < 1 || !Array.isArray(s.notes) || !s.notes.length) throw new Error(`Pattern ${k+1}: needs "len" (≥ 1) and a non-empty "notes" array.`);
    const notes = s.notes.map((n, j) => {
      if (!Array.isArray(n) || n.length !== 3 || !n.every(Number.isFinite)) throw new Error(`Pattern ${k+1}, note ${j+1}: use [onset, duration, midi].`);
      return [Math.max(0, Math.round(n[0]*PPE)), Math.max(1, Math.round(n[1]*PPE)), clamp(Math.round(n[2]), 24, 108)];   // eighths in, sixteenth pulses inside
    }).filter(n => n[0] < Math.round(s.len*PPE));
    if (!notes.length) throw new Error(`Pattern ${k+1}: every note starts after the pattern ends.`);
    return {len:Math.max(1, Math.round(s.len*PPE)), notes};
  });
}
function reset(){
  E.gen = new Gen(E.seedNum, E.seeds);
  E.gen.get(0);
  E.agents = []; E.lastT = 0; E.cycles = 0; E.log = []; E.flags = {}; E.joinCooldown = E.clock + 8; E.gather = null; E.phase = null; E.phaseQuietUntil = 0; initForm(); initTechno();
  E.gen.useEx = E.excite; E.gen.mode = E.genMode || 'v2'; E.traffic = 0.5;
  initSlots(); initTuning();
  E.openStart = E.clock; E.openUntil = E.clock + 12;   // the pulse plays alone for at least 12 s while the instrument samples load
  log('The pulse alone while the instruments load');
  if (FIXED){ fixEnsemble(FIXED); log(`Started (seed ${E.seedNum}, ${E.seeds.length} seed patterns)`); return; }
  const pool = E.slots.slice(), first = [];
  for (let k=0; k<=E.minN && pool.length; k++){ const s = pickByRole(pool, first); pool.splice(pool.indexOf(s), 1); first.push(s); }
  first.forEach((s, k) => { s.waitUntil = E.openUntil + (k === 0 ? 0.2 : k < E.minN ? 4 + Math.random()*30 : 15 + Math.random()*20); });
  log(`Started (seed ${E.seedNum}, ${E.seeds.length} seed patterns)`);
}
