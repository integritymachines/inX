'use strict';
/* Sampler: recorded instruments, loaded in the background after Start.
   Sources: VSCO 2 Community Edition by Versilian Studios (CC0); saxophone and guitar from the Tone.js instrument samples
   by Nicholas Brosowsky (CC-BY 3.0; originally Karoryfer Samples and the University of Iowa Electronic Music Studios).
   A note uses the nearest recorded pitch, sped up or slowed down (so just intonation works); notes outside an instrument's
   recorded range move by octaves into it. Strings, winds and brass have short and sustained recordings, chosen by note length.
   Until an instrument has loaded, its synth voice stands in. */
const SAMPLER = {manifest:null, buf:{}, ready:{}, loading:{}, failed:false, loaded:0};
const RING = {piano1:0.9, piano2:0.8, harp:1.4, guitar:1.0, marimba:0.5, xylo:0.35, glock:1.6, timpani:1.4, handperc:0.25};
async function loadManifest(){
  try { const r = await fetch('samples/manifest.json'); if (!r.ok) throw new Error(r.status); SAMPLER.manifest = await r.json(); }
  catch (e){ SAMPLER.failed = true; log('Recorded instruments could not be loaded; synth voices play instead.'); }
}
async function loadInstrument(inst){
  if (!ctx || !SAMPLER.manifest || SAMPLER.loading[inst]) return;
  const m = SAMPLER.manifest[inst]; if (!m) return;
  SAMPLER.loading[inst] = true;
  const sets = {};
  await Promise.all(Object.entries(m.sets).flatMap(([set, list]) => list.map(async ([root, file]) => {
    try {
      const r = await fetch('samples/' + file); const ab = await ctx.decodeAudioData(await r.arrayBuffer());
      (sets[set] ||= []).push({root, ab});
    } catch (e) {}
  })));
  for (const k in sets) sets[k].sort((x, y) => x.root - y.root);
  if (Object.keys(sets).length){ SAMPLER.buf[inst] = sets; SAMPLER.ready[inst] = true; SAMPLER.loaded++; }
}
/* Players on stage first, then the rest of the roster, two at a time. */
async function preloadSamples(){
  if (!SAMPLER.manifest) await loadManifest();
  if (!SAMPLER.manifest){ E.samplesReady = true; return; }   // no samples: the synthesized voices play
  const onStage = new Set(E.agents.map(a => SECTIONS[a.sec].sample));
  const order = [...onStage, ...ST.roster.map(k => SECTIONS[k].sample).filter(s => !onStage.has(s))];
  const queue = [...new Set(order)];
  const worker = async () => { while (queue.length) await loadInstrument(queue.shift()); };
  await Promise.all([worker(), worker()]);
  E.samplesReady = true;
  log(`Recorded instruments loaded (${SAMPLER.loaded} of ${queue.length + SAMPLER.loaded})`);
}
const PANS = {};
function sectionOut(key){
  if (!PANS[key]){ const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = SECTIONS[key].pan || 0; p.connect(music || bus); PANS[key] = p; }
  return PANS[key];
}
function playSample(spec, m, t, dur, vel, bright, dest){
  const inst = spec.sample; if (!SAMPLER.ready[inst]) return false;
  const kind = SAMPLER.manifest[inst].kind, b = SAMPLER.buf[inst];
  const set = b.all || ((dur <= 0.32 && b.short) ? b.short : (b.long || b.short));
  if (!set || !set.length) return false;
  let pick, rate = 1;
  if (kind === 'unpitched') pick = set[clamp(Math.floor((m - 40)/8), 0, set.length - 1)];   // register picks the drum
  else {
    const lo = set[0].root - 3, hi = set[set.length - 1].root + 4;
    while (m < lo) m += 12;
    while (m > hi) m -= 12;
    pick = set.reduce((x, y) => Math.abs(y.root - m) < Math.abs(x.root - m) ? y : x);
    rate = tunedHz(m)/etHz(pick.root);
  }
  const src = ctx.createBufferSource(); src.buffer = pick.ab; src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(18000, 9000*bright);
  const g = ctx.createGain(); src.connect(lp); lp.connect(g); g.connect(dest);
  const which = kind === 'sus' && set === b.long ? 'long' : 'short';
  const len = pick.ab.duration/rate, v = vel*Math.pow(10, ((BALANCE_DB[inst] ? BALANCE_DB[inst][which] : 0) + ROLE_DB[spec.role])/20);
  const end = Math.min(t + len, t + dur + (kind === 'sus' ? 0.18 : (RING[inst] || 0.6)));
  const fade = kind === 'sus' ? 0.15 : 0.08;
  g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, Math.max(t, end - fade)); g.gain.linearRampToValueAtTime(0, end);
  src.start(t); src.stop(end + 0.02);
  return true;
}
/* One note for one player: the recording if it has loaded, otherwise the synth voice. */
function playNote(key, m, t, dur, gain, bright){
  const spec = SECTIONS[key], dest = sectionOut(key);
  const e = elecMix();                                        // equal-power crossfade, recording → electronic voice
  const ga = Math.cos(e*Math.PI/2), ge = Math.sin(e*Math.PI/2);
  if (ge > 0.02){
    const trim = ELECTRO_DB[key] ? clamp(ELECTRO_DB[key][dur > 0.32 ? 'long' : 'short'], -12, 12) : -8;
    electroVoice(key, m, t, dur, 0.24*gain*ge*Math.pow(10, (trim + ROLE_DB[spec.role])/20), bright, dest);
  }
  if (ga < 0.02) return;
  if (playSample(spec, m, t, dur, 0.24*gain*ga, bright, dest)) return;
  voice(spec, m, t, dur, 0.13*SYNTH_GAIN[spec.synth]*gain*ga*Math.pow(10, ROLE_DB[spec.role]/20), bright, dest);
}
