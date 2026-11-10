'use strict';
/* Scheduler and interface. */
/* ---------------- UI ---------------- */
const $ = s => document.querySelector(s);
const SHARP_KEYS = ['C','G','D','A','E','B','F♯','C♯','G♯','D♯'];
const FLAT_KEYS = ['C','F','B♭','E♭','A♭','D♭','G♭','C♭','F♭','B♭♭'];
function keyName(s){ return (s >= 0 ? SHARP_KEYS[Math.min(s, 9)] : FLAT_KEYS[Math.min(-s, 9)]) + ' major'; }
const mmss = t => { const s = Math.floor(t); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

$('#seeds').value = JSON.stringify(JSON.parse(DEFAULT_SEEDS_JSON), null, 0).replace(/\},\{/g, '},\n{');
E.seeds = parseSeeds(DEFAULT_SEEDS_JSON);


$('#start').addEventListener('click', async () => {
  try {
    if (!ctx) initAudio();
    if (E.running){ E.running = false; await ctx.suspend(); $('#start').textContent = 'Resume'; return; }
    await ctx.resume();
    if (!E.started){ reset(); E.started = true; $('#players').dataset.idle = ''; buildRoster(); preloadSamples(); }
    E.nextT = ctx.currentTime + 0.1; E.running = true; $('#start').textContent = 'Pause';
  } catch (e) { log('This browser refused to start audio: ' + e.message); }
});
document.querySelectorAll('[data-tech]').forEach(cb => {
  cb.checked = TECH_ON[cb.dataset.tech];
  cb.addEventListener('change', () => { setTechnique(cb.dataset.tech, cb.checked); markCustom(); syncGrey(); if (E.started) log(`${TECH[cb.dataset.tech].label} ${cb.checked ? 'on' : 'off'}`); });
});
function setRange(id, v){ const el = $(id); el.value = v; el.dispatchEvent(new Event('input')); }
function onStyleApplied(){
  if (typeof $ !== 'function' || !$('#tempo')) return;
  setRange('#tempo', ST.pulseMs); setRange('#gap', ST.gap);
}
const bindRange = (id, fn) => { const el = $(id); const upd = () => fn(+el.value); el.addEventListener('input', upd); upd(); };
$('#excite').addEventListener('change', e => { E.excite = e.target.checked; if (E.gen) E.gen.useEx = E.excite; });
function syncPlayers(){
  const a = +$('#minn').value, b = +$('#maxn').value;
  $('#players-o').textContent = `${a}–${b}`;
  $('#dfill').style.left = `calc(${(a - 1)/23} * (100% - 16px))`; $('#dfill').style.right = `calc(${(24 - b)/23} * (100% - 16px))`;   // from thumb centre to thumb centre, padded by half a thumb
  $('#minn').style.zIndex = a > 20 ? 2 : 1;   // keep the lower thumb reachable when both sit at the top
}
bindRange('#minn', v => { if (v > 12){ v = 12; $('#minn').value = 12; } E.minN = v; if (+$('#maxn').value < v){ $('#maxn').value = v; E.maxN = v; } syncPlayers(); });
bindRange('#maxn', v => { markCustom(); if (v < 2){ v = 2; $('#maxn').value = 2; } E.maxN = v; if (+$('#minn').value > v){ $('#minn').value = v; E.minN = v; } syncPlayers(); });
/* Stay per pattern: average time a player spends on a pattern before moving on, 5 s to 2 min on a log scale.
   A live In C runs its 53 patterns in about an hour: roughly a minute each. */
const stayOf = v => Math.round(5*Math.pow(24, v/100));
bindRange('#stay', v => { STAY.sec = stayOf(v); $('#stay-o').textContent = STAY.sec >= 60 ? `${(STAY.sec/60).toFixed(STAY.sec % 60 ? 1 : 0)} min` : `${STAY.sec} s`; markCustom(); });
let tempoMode = null;
function syncTempo(){
  const club = TECHNO.X >= 0.25, el = $('#tempo');
  if (club !== tempoMode){
    tempoMode = club;
    if (club){ el.min = 60; el.max = 200; el.step = 1; $('#tempo-l').textContent = 'Tempo'; }
    else { el.min = 100; el.max = 500; el.step = 1; $('#tempo-l').textContent = 'Tempo'; }
  }
  el.value = club ? bpmOf(TECHNO.userPeriod) : Math.round(TECHNO.userPeriod*1000*PPE);   // In C: ms per eighth note
  $('#tempo-o').textContent = club ? `${bpmOf(TECHNO.userPeriod)} BPM` : `${Math.round(TECHNO.userPeriod*1000*PPE)} ms`;
}
var presetQuiet = false;
// the preset stays shown when you change controls: it is the starting point you are working from
function markCustom(){ if (!presetQuiet){ if (RAMP && !RAMP.done){ RAMP.done = true; log('Focus ramp stopped: your settings'); } } }
$('#tempo').addEventListener('input', e => {
  const v = +e.target.value;
  TECHNO.userPeriod = TECHNO.X >= 0.25 ? 60/(4*v) : v/1000/PPE; TECHNO.bpm = bpmOf(TECHNO.userPeriod);
  syncTempo(); markCustom();
});
bindRange('#techno', v => { TECHNO.X = v/100; $('#techno-o').textContent = `${v}% · ${technoStage()}`; syncTempo(); markCustom(); if (typeof syncGrey === 'function') syncGrey(); });
bindRange('#john', v => { JOHN.depth = v/100; $('#john-o').textContent = `${v}%`; markCustom(); });
bindRange('#terry', v => { TERRY.spread = SPREAD = v; $('#terry-o').textContent = v; markCustom(); });
bindRange('#philip', v => { PHILIP.amount = v/100; $('#philip-o').textContent = `${v}%`; markCustom(); });
bindRange('#steve', v => { STEVE.amount = v/100; $('#steve-o').textContent = `${v}%`; markCustom(); });
bindRange('#lamonte', v => { LAMONTE.drone = v/100; $('#lamonte-o').textContent = `${v}%`; markCustom(); });
bindRange('#evo', v => { EVO.amount = v/100; $('#evo-o').textContent = `${v}%`; markCustom(); });
/* Grey out sliders that have nothing to act on. */
function syncGrey(){
  const set = (id, on) => { const el = $(id); el.disabled = !on; el.closest('.crow, .ctl').classList.toggle('dim', !on); };
  set('#philip', TECH_ON.glass); set('#steve', TECH_ON.reich); set('#john', TECH_ON.adams); set('#lamonte', TECH_ON.young); set('#evo', TECHNO.X >= 0.2);
}
const presetSel = $('#preset');
for (const [name, keys] of PRESET_GROUPS){ const g = document.createElement('optgroup'); g.label = name;
  for (const k of keys){ const o = document.createElement('option'); o.value = k; o.textContent = k === 'random' ? 'Random' : PRESETS[k].label.replace(' (ADHD)', ''); g.appendChild(o); }
  presetSel.appendChild(g); }
presetSel.value = 'inc';
syncGrey();
presetSel.addEventListener('change', () => { applyPreset(presetSel.value); if (E.started) log(`Preset: ${presetSel.selectedOptions[0].textContent}`); });
// choosing the shown preset again (e.g. Random for a new draw) needs a click on the menu: the select fires no change for the same value, so offer a re-apply on double-click
presetSel.addEventListener('dblclick', () => applyPreset(presetSel.value));
function onPresetApplied(P){
  presetQuiet = true;
  setRange('#techno', Math.round(P.X*100)); syncTempo();
  setRange('#maxn', P.maxN); setRange('#minn', P.minN ?? 2); setRange('#stay', Math.round(100*Math.log((P.stay ?? 20)/5)/Math.log(24))); setRange('#gap', P.gap ?? 30); setRange('#pulse', Math.round(100*(P.pulse ?? 0.5)));
  setRange('#terry', P.terry ?? 3); setRange('#philip', Math.round((P.philip ?? 0.5)*100)); setRange('#steve', Math.round((P.steve ?? 0.5)*100));
  if (P.john !== undefined) setRange('#john', Math.round(P.john*100));
  if (P.drone !== undefined) setRange('#lamonte', Math.round(P.drone*100));
  if (P.evo !== undefined) setRange('#evo', Math.round(P.evo*100));
  syncGrey();
  document.querySelectorAll('[data-tech]').forEach(cb => { cb.checked = TECHNO_ON_CHECK(cb.dataset.tech); });
  presetQuiet = false;
}
function TECHNO_ON_CHECK(k){ return TECH_ON[k]; }
bindRange('#gap', v => { E.gap = v; $('#gap-o').textContent = v; });
bindRange('#lease', v => { E.leaseMid = v; $('#lease-o').textContent = `${Math.round(v*0.5)}–${Math.round(v*1.5)} s`; });
bindRange('#pulse', v => { E.pulseLevel = v/100; $('#pulse-o').textContent = v ? `${v}%` : 'off'; });
$('#reseed').addEventListener('click', () => {
  try {
    E.seeds = parseSeeds($('#seeds').value);
    E.seedNum = (parseInt($('#seed').value, 10) || 0) >>> 0;
    $('#seed-err').textContent = '';
    if (E.started) reset();
  } catch (e) { $('#seed-err').textContent = e.message; }
});

function phaseOf(){
  if (!E.started) return 'Not started';
  const act = active();
  if (!act.length) return 'Silence';
  if (E.gather) return E.gather.dropping ? 'Dropout' : E.gather.climax ? 'Climax' : 'Calling everybody in';
  if (E.agents.some(a => a.mode === 'out')) return act.length === 1 ? 'Solo' : 'Restart';
  return 'Flow';
}
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

const cv = $('#stream'), g2 = cv.getContext('2d');
const dv = $('#drums'), g3 = dv.getContext('2d');
const DRUM_COLORS = {kick:'#e8603c', hat:'#e0b83a', clap:'#e86fa8', ohat:'#8fc93f', perc:'#33b8cc', bass:'#8a6cf0'};   // clip colors, Ableton-style
function drawDrums(){
  const show = TECHNO.X > 0; dv.classList.toggle('on', show); document.querySelector('.dash').classList.toggle('techno', show); if (!show) return;
  const dpr = window.devicePixelRatio || 1, w = dv.clientWidth, h = dv.clientHeight;
  if (dv.width !== Math.round(w*dpr) || dv.height !== Math.round(h*dpr)){ dv.width = Math.round(w*dpr); dv.height = Math.round(h*dpr); }
  g3.setTransform(dpr, 0, 0, dpr, 0, 0); g3.clearRect(0, 0, w, h);
  const ink = css('--ink'), muted = css('--muted'), line = css('--line'), accent = css('--accent');
  const labW = 78, rows = DRUMS.length, rh = (h - 2)/rows, cw = (w - labW - 4)/16, step = mod(E.p - 1, BAR);
  g3.font = `10px ${css('--mono')}`; g3.textBaseline = 'middle';
  DRUMS.forEach((d, r) => {
    const y = 1 + r*rh, lv = (TECHNO.level[d.key] || 0)*(TECHNO.gate[d.key] ?? 1), on = lv > 0.05;
    g3.fillStyle = on ? ink : muted; g3.fillText(d.label, 2, y + rh/2);
    const pat = TECHNO.pat[d.key] || [];
    for (let i=0;i<16;i++){
      const x = labW + i*cw;
      const now = i === step && E.running, col = DRUM_COLORS[d.key];
      if (pat[i]){ g3.fillStyle = on ? col : muted; g3.globalAlpha = on ? (now ? 1 : 0.4 + 0.5*pat[i]) : 0.25; }
      else { g3.fillStyle = now ? accent : line; g3.globalAlpha = now ? 0.3 : 0.15; }
      g3.fillRect(x + 1, y + 1, cw - 2, rh - 2);
      if (now && pat[i] && on){ g3.globalAlpha = 1; g3.strokeStyle = ink; g3.lineWidth = 1; g3.strokeRect(x + 1.5, y + 1.5, cw - 3, rh - 3); }
      g3.globalAlpha = 1;
    }
  });
}
function drawStream(){
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, w, h);
  const ink = css('--ink'), muted = css('--muted'), line = css('--line'), accent = css('--accent');
  g2.font = `12px ${css('--mono')}`;
  if (!E.gen){ g2.fillStyle = muted; g2.fillText('Press "Start listening". The patterns in play will appear here.', 12, 24); return; }
  const S = stats(), have = E.gen.pats.length - 1;
  const hi = S.act.length ? S.hi : 0, lo = S.act.length ? S.lo : 0;   // before anyone plays, the stream shows what is coming from pattern 0
  const N = 15, from = Math.max(0, lo - 4), to = from + N - 1;
  // generate ahead for the preview, one pattern per frame so it never stalls the audio; this starts during the opening pulse
  if (E.started && !(E.gather && E.gather.dropping) && have < to) E.gen.get(have + 1);
  const cells = []; for (let i=from;i<=Math.min(to, E.gen.pats.length - 1);i++) if (E.gen.pats[i]) cells.push(E.gen.pats[i]);
  const n = N, cw = (w - 8)/n, top = 16, rollH = h - 62;
  g2.font = `10.5px ${css('--mono')}`;
  let mn = 99, mx = 0; for (const P of cells) for (const m of P.midi){ mn = Math.min(mn, m); mx = Math.max(mx, m); }
  if (mn > mx){ mn = 55; mx = 79; } mn -= 2; mx += 2;
  cells.forEach((P, k) => {
    const x = 4 + k*cw, inPlay = P.i >= lo && P.i <= hi, next = P.i > hi;
    g2.strokeStyle = inPlay ? accent : line; g2.lineWidth = inPlay ? 1.5 : 1;
    if (next) g2.setLineDash([3, 3]);
    g2.strokeRect(x+2, top, cw-4, rollH); g2.setLineDash([]);
    g2.globalAlpha = next ? 0.5 : 1;
    g2.fillStyle = inPlay ? ink : muted;
    const tag = {seed:'S', mut:'M', cross:'X', new:'N'}[P.op];
    g2.fillText(`${P.i}${tag}${P.fn ? ' ' + P.fn : ''}`, x+3, top-5);
    g2.fillStyle = line; g2.fillRect(x+2, top+rollH+3, cw-4, 3); g2.fillStyle = accent; g2.fillRect(x+2, top+rollH+3, (cw-4)*(P.ex||0), 3);
    if (P.keyChange){ g2.fillStyle = accent; g2.fillRect(x+1, top, 2, rollH); }
    const iw = cw-8, ih = rollH-10;
    P.notes.forEach((nt, j) => {
      const yy = top + 5 + ih*(1 - (P.midi[j]-mn)/(mx-mn));
      g2.fillStyle = inPlay ? ink : muted;
      g2.fillRect(x+4 + iw*nt.o/P.len, yy-1.5, Math.max(2, iw*nt.d/P.len - 1), 3);
    });
    g2.globalAlpha = 1;
    const here = S.act.filter(a => a.idx === P.i);
    here.forEach((a, j) => {
      const per = Math.max(3, Math.floor((cw - 6)/8)), col = j % per, row = Math.floor(j/per);
      const cx = x + 6 + col*8, cy = top + rollH + 14 + row*8;
      g2.globalAlpha = a.resting ? 0.35 : 1;
      g2.fillStyle = SECTIONS[a.sec].color; g2.beginPath(); g2.arc(cx, cy, 3, 0, Math.PI*2); g2.fill();
      g2.globalAlpha = 1;
    });
  });
}
let tiles = [];
function buildRoster(){
  const box = $('#players'); box.innerHTML = '';
  tiles = E.slots.map(sl => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile'; b.dataset.slot = sl.i; b.style.setProperty('--tc', SECTIONS[sl.sec].color);
    b.innerHTML = `<span class="nm"><span class="dot" style="background:${SECTIONS[sl.sec].color}"></span><span class="lab"></span></span>`
      + `<span class="pill"></span><span class="meta"><span class="pr"></span><span class="ls"></span></span><span class="bar"><i></i></span>`;
    box.appendChild(b);
    return {b, lab:b.querySelector('.lab'), pill:b.querySelector('.pill'), pr:b.querySelector('.pr'), ls:b.querySelector('.ls'), bar:b.querySelector('.bar i')};
  });
}
$('#players').addEventListener('click', e => {
  const b = e.target.closest('.tile'); if (!b || !E.started) return;
  const sl = E.slots[+b.dataset.slot]; if (sl){ toggleSlot(sl); render(); }
});
function renderPlayers(){
  if (!E.started){
    if (!$('#players').dataset.idle){ $('#players').dataset.idle = '1'; $('#players').innerHTML = ST.roster.map(sec => `<div class="tile off"><span class="nm"><span class="dot" style="background:${SECTIONS[sec].color}"></span>${SECTIONS[sec].label}</span><span class="pill">off</span></div>`).join(''); }
    return;
  }
  if (tiles.length !== E.slots.length || !tiles[0].b.isConnected) buildRoster();
  E.slots.forEach((sl, k) => {
    const r = tiles[k], a = sl.agent, st = slotState(sl), on = slotIsOn(sl);
    const live = a && a.mode !== 'out';
    r.b.classList.toggle('off', st === 'off');
    r.b.setAttribute('aria-pressed', on ? 'true' : 'false');
    r.b.setAttribute('aria-label', `${SECTIONS[sl.sec].label}: ${st}. Tap to switch ${on ? 'off' : 'on'}.`);
    r.lab.textContent = SECTIONS[sl.sec].label + (live && a.octUp ? ' ↑8va' : '');
    r.pill.className = 'pill ' + (st.startsWith('phasing') ? 'phasing' : /^(additive|subtractive)/.test(st) ? st.split(' ')[0] : st.replace(/ /g, '-')); r.pill.textContent = st;
    const by = a ? (a.manual ? 'you' : '') : (st === 'waiting' && sl.manual ? 'you' : '');
    r.pr.textContent = live ? `p${a.idx}·r${a.reps}` : (by || '');
    r.ls.textContent = !a ? (st === 'waiting' ? 'soon' : '') : a.manual ? 'you' : a.leaving ? '' : mmss(Math.max(0, a.leaseEnd - E.clock));
    r.bar.style.width = live && !a.resting ? `${(clamp((E.p - a.curStart)/a.curLen, 0, 1)*100).toFixed(0)}%` : '0%';
  });
}
function renderLog(){
  $('#log').innerHTML = E.log.slice(0, 12).map(e => `<li><time>${mmss(e.t)}</time><span>${e.msg}</span></li>`).join('') || '<li><span>Players joining and leaving, gatherings, new sections.</span></li>';
}
const buf = new Float32Array(1024);
function render(){
  $('#c-phase').innerHTML = `<b>phase</b>${phaseOf()}`;
  if (E.gen){
    const S = stats();
    $('#c-pat').textContent = S.act.length ? `${S.lo}–${S.hi}` : '–';
    $('#c-key').textContent = keyName(E.gen.s);
    $('#c-sec').textContent = E.gen.epoch + 1;
    $('#c-int').textContent = ST.wave ? `${(E.I*100).toFixed(0)}%${waveRising() ? ' ↗' : ' ↘'}` : '–';
    $('#int').style.width = ST.wave ? `${(E.I*100).toFixed(0)}%` : '0%';
    $('#c-pl').textContent = `${S.act.length} of ${ST.roster.length}`;
    $('#pl').style.width = `${(100*S.act.length/ST.roster.length).toFixed(0)}%`;
  }
  $('#traf').style.width = `${(E.traffic*100).toFixed(0)}%`; $('#traf-o').textContent = E.started ? `${(E.traffic*100).toFixed(0)}%` : '–';
  if (analyser){
    analyser.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x*x;
    const db = 20*Math.log10(Math.sqrt(s/buf.length) + 1e-9);
    $('#lvl').style.width = `${clamp((db + 50)/50, 0, 1)*100}%`;
    $('#lvl-o').textContent = db < -60 ? '–' : `${db.toFixed(0)} dBFS`;
  }
  drawStream(); drawDrums(); renderPlayers(); renderLog();
}
let last = 0;
function loop(ts){ if (ts - last > 150){ last = ts; render(); } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.addEventListener('resize', () => render());

/* Test hook: run the ensemble without sound. */
window.InX = { E, reset, stats, toggleSlot, slotState, simulate1(){ E.audio = false; pulse(0); }, simulate(n){ const was = E.audio; E.audio = false; for (let k=0;k<n;k++) pulse(0); E.audio = was; render(); } };

/* Setup screen: the instruments on stage. */
const FAMILIES = [
  ['Keyboards', ['piano1', 'piano2', 'organ']],
  ['Strings', ['violins', 'viola', 'cellos', 'bass']],
  ['Plucked', ['harp', 'guitar']],
  ['Woodwinds', ['piccolo', 'flute', 'oboe', 'clarinet', 'sax', 'bassoon']],
  ['Brass', ['horn', 'trumpet', 'trombone', 'tuba']],
  ['Percussion', ['marimba', 'xylo', 'glock', 'timpani', 'handperc', 'congas', 'darbuka', 'bells']],
];
const DEFAULT_ROSTER = STYLES.inc.roster.slice();
const ROLE_ABBR = {foundation:'F', line:'L', color:'C'};
function syncSetup(){
  const on = new Set(ST.roster);
  $('#picker').innerHTML = FAMILIES.map(([fam, keys]) => `<div class="fam">${fam}</div><div class="picks">` +
    keys.filter(k => SECTIONS[k]).map(k => `<button type="button" class="pick${on.has(k) ? ' on' : ''}" data-sec="${k}" aria-pressed="${on.has(k)}"><span class="dot" style="background:${SECTIONS[k].color}"></span>${SECTIONS[k].label}<span class="role" title="${SECTIONS[k].role}">${ROLE_ABBR[SECTIONS[k].role]}</span></button>`).join('') + '</div>').join('');
  $('#pick-count').textContent = `${ST.roster.length} of 24`;
}
$('#picker').addEventListener('click', e => {
  const b = e.target.closest('.pick'); if (!b) return;
  const k = b.dataset.sec, cur = ST.roster.slice();
  let next;
  if (cur.includes(k)){ if (cur.length <= 2) return; next = cur.filter(x => x !== k); }
  else { if (cur.length >= 24) return; next = cur.concat(k); }
  const order = FAMILIES.flatMap(f => f[1]);   // keep the stage in family order
  next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  setRoster(next); syncSetup();
});
$('#pick-default').addEventListener('click', () => { setRoster(DEFAULT_ROSTER); syncSetup(); });
syncSetup();
