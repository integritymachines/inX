'use strict';
/* Dynamics and orchestration.
   1. Loudness control: a model of how loud the ensemble is (each sounding player's share of sounding time, by role) is
      smoothed over a few seconds and compensated by one ensemble-wide gain, so that the number of players and the
      busyness of their patterns no longer swing the level at random. A larger ensemble is still allowed to be up to
      FULL_DB louder than two players. Intended dynamics (Terry's slow shaping, John's waves, the climax, the dropout)
      act on top of this.
   2. Terry's shaping: without John's waves, the level breathes slowly, about ±3 dB over a few minutes.
   3. Orchestration: arrivals favor the group (foundation, line, color) the ensemble is missing or short of. */
const FULL_DB = 3;                 // 24 players may be this much louder than 2
const DYN = {loud:0, comp:1, lastN:0};
function playerEnergy(a){
  if (a.resting || a.mode === 'out' || a.removed) return 0;
  const P = E.gen.get(a.idx), spec = SECTIONS[a.sec];
  const perc = SAMPLER.manifest && SAMPLER.manifest[spec.sample] && SAMPLER.manifest[spec.sample].kind !== 'sus';
  let duty = 0;
  for (const n of P.notes) duty += perc ? Math.min(n.d, 3)*0.5 : n.d;
  duty = Math.min(1.5, duty/P.len);
  return duty*Math.pow(10, ROLE_DB[spec.role]/10);
}
/* Called every pulse. */
function dynamicsStep(){
  const act = active();
  let L = 0; for (const a of act) L += playerEnergy(a);
  if (E.gather || E.agents.some(a => a.mode === 'out')) return;   // hold still through a gathering and its solo: the swell is the point
  const alpha = Math.min(1, E.period/4);                       // about 4 s of smoothing
  DYN.loud = DYN.loud ? DYN.loud + alpha*(L - DYN.loud) : L;
  const n = act.filter(a => !a.resting).length;
  const want = 1.0*Math.pow(10, FULL_DB/10*clamp(Math.log2(Math.max(n, 2)/2)/Math.log2(12), 0, 1));
  DYN.comp = clamp(Math.sqrt(want/Math.max(DYN.loud, 1e-3)), 0.35, 2.8);   // at most ±9 dB of correction
  DYN.lastN = n;
}
function applyDynamics(){ if (music && ctx){ music.gain.setTargetAtTime(DYN.comp, ctx.currentTime, 1.0); bus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5); } }
/* Terry's slow shaping, used when John's waves are off. */
function terryDb(){ const t = E.clock; return (1 - MODE.flatten)*(2.2*Math.sin(2*Math.PI*t/240 + 1) + 0.8*Math.sin(2*Math.PI*t/97)); }
function formGain(){ return ST.wave ? waveGain() : Math.pow(10, terryDb()/20); }
/* Orchestration: how far each group is from its share, counting players sounding and on their way. */
function roleNeed(extra = []){
  const cnt = {foundation:0, line:0, color:0}; let total = 0;
  for (const a of active()){ cnt[SECTIONS[a.sec].role]++; total++; }
  for (const s of E.slots) if (s.waitUntil !== null && !s.agent){ cnt[SECTIONS[s.sec].role]++; total++; }
  for (const s of extra){ cnt[SECTIONS[s.sec].role]++; total++; }
  const need = {};
  for (const r of ROLES) need[r] = ROLE_SHARE[r]*(total + 1) - cnt[r] + (cnt[r] === 0 && total >= 2 ? 2 : 0);
  return {need, cnt, total};
}
function pickByRole(slots, extra = []){
  if (!slots.length) return null;
  const {need} = roleNeed(extra);
  const ws = slots.map(s => Math.exp(1.5*need[SECTIONS[s.sec].role]));
  let t = ws.reduce((x, y) => x + y, 0)*Math.random();
  for (let k=0;k<slots.length;k++){ t -= ws[k]; if (t <= 0) return slots[k]; }
  return slots[slots.length - 1];
}
