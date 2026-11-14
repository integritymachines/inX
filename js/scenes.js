'use strict';
/* Scenes: one JSON object that holds everything a preset sets, plus the stage line-up and the seed patterns.
   {inx:1, name, base, settings:{...}, players:[...], roster:[...], seeds:[...], seed}
   - base: a built-in preset to start from; settings override it (mode merges into the base's mode).
   - players: a fixed ensemble (as the club presets); roster: the instruments on stage (as chosen in Setup).
   - seeds: patterns in eighth notes, each {len, notes:[[onset, duration, MIDI]]}; halves (0.5) for sixteenths.
   A bare array is read as seeds alone. */
const SETTING_KEYS = ['X', 'bpm', 'pulseMs', 'composers', 'terry', 'pulse', 'philip', 'steve', 'john', 'drone', 'evo', 'stay', 'gap', 'lease',
                      'minN', 'maxN', 'wet', 'kit', 'mode', 'ramp'];
E.seedsSrc = JSON.parse(DEFAULT_SEEDS_JSON);
function sceneToPreset(sc){
  const base = PRESETS[sc.base] || PRESETS.inc, P = JSON.parse(JSON.stringify(base)), S = sc.settings || {};
  for (const k of SETTING_KEYS) if (k in S){
    if (k === 'mode') P.mode = Object.assign({}, base.mode || {}, S.mode);
    else P[k] = S[k];
  }
  if ('bpm' in S) delete P.pulseMs; if ('pulseMs' in S) delete P.bpm;
  if (!P.bpm && !P.pulseMs) P.pulseMs = 200;
  if ('players' in sc){ if (sc.players && sc.players.length) P.players = sc.players.filter(k => SECTIONS[k]); else delete P.players; }
  P.label = sc.name || 'Scene';
  return P;
}
function applyScene(sc, key){
  if (Array.isArray(sc)) sc = {seeds:sc};
  if (!sc || typeof sc !== 'object') throw new Error('A scene is a JSON object, or an array of seed patterns.');
  if (sc.base || sc.settings || 'players' in sc){
    if (sc.base && !PRESETS[sc.base]) throw new Error(`Unknown base preset "${sc.base}".`);
    applyPresetObject(sceneToPreset(sc), key || 'scene');
    if (E.started) log(`Scene: ${sc.name || 'untitled'}`);
  }
  if (Array.isArray(sc.roster)){
    const r = sc.roster.filter(k => SECTIONS[k]).slice(0, 24);
    if (r.length >= 2){ setRoster(r); if (typeof syncSetup === 'function') syncSetup(); }
  }
  if (sc.settings && 'lease' in sc.settings) setRange('#lease', sc.settings.lease);
  const newSeeds = sc.seeds ? JSON.stringify(sc.seeds) : null, newNum = Number.isFinite(sc.seed) ? sc.seed >>> 0 : null;
  if ((newSeeds && newSeeds !== JSON.stringify(E.seedsSrc)) || (newNum !== null && newNum !== E.seedNum)){
    if (newSeeds){ E.seeds = parseSeeds(newSeeds); E.seedsSrc = sc.seeds; }
    if (newNum !== null){ E.seedNum = newNum; $('#seed').value = newNum; }
    if (E.started) reset();   // new seeds mean a new stream: start over
  }
}
/* The running settings as a scene. */
function currentScene(name){
  const club = TECHNO.X >= 0.25, per = TECHNO.userPeriod;
  return {inx:1, name:name || 'My scene', settings:{
      X:+TECHNO.X.toFixed(2), ...(club ? {bpm:bpmOf(per)} : {pulseMs:Math.round(per*1000*PPE)}),
      composers:Object.keys(TECH_ON).filter(k => TECH_ON[k]), terry:TERRY.spread, pulse:+E.pulseLevel.toFixed(2),
      philip:PHILIP.amount, steve:STEVE.amount, john:JOHN.depth, drone:LAMONTE.drone, evo:EVO.amount,
      stay:STAY.sec, gap:E.gap, lease:E.leaseMid, minN:E.minN, maxN:E.maxN, wet:TECHNO.wet ?? 0.28,
      kit:TECHNO.kit ? JSON.parse(JSON.stringify(TECHNO.kit)) : null,
      mode:{peakDb:MODE.peakDb, surprise:MODE.surprise, gridAll:MODE.gridAll, flatten:MODE.flatten, tuning:MODE.tuning, scale:MODE.scale}},
    players:FIXED ? FIXED.slice() : null, roster:ST.roster.slice(), seeds:E.seedsSrc, seed:E.seedNum};
}
/* Scenes kept in this browser ("My scenes" in the preset menu). Storage may be unavailable: then only files work. */
function myScenes(){ try { return JSON.parse(localStorage.getItem('inx-scenes') || '{}'); } catch (e) { return {}; } }
function storeScene(sc){ try { const all = myScenes(); all[sc.name] = sc; localStorage.setItem('inx-scenes', JSON.stringify(all)); return true; } catch (e) { return false; } }
function forgetScene(name){ try { const all = myScenes(); delete all[name]; localStorage.setItem('inx-scenes', JSON.stringify(all)); } catch (e) {} }
