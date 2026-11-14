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

/* Built-in scenes "in the style of": original seed patterns, settings and line-ups written to suggest a composer's or a
   tradition's manner; no material is taken from any piece. Patterns in eighth notes, halves for sixteenths. */
const SN = (len, notes) => ({len, notes});
const STYLE_SCENES = {
  pulse: {inx:1, name:'Pulse study (after Reich)', base:'minimal',
    settings:{X:0, pulseMs:200, composers:['reich'], steve:0.7, terry:3, pulse:0.6, stay:30, gap:36, wet:0.24, minN:3, maxN:10, mode:{scale:'aeolian'}},
    players:['piano1','piano2','marimba','xylo','vibes','clarinet','flute','violins','cellos','bass'],
    seeds:[SN(2,[[0,1,57],[1,1,64]]), SN(4,[[0,1,69],[1,1,69],[2,1,71],[3,1,69]]), SN(6,[[0,1,76],[1,1,72],[2,1,74],[3,1,76],[4,1,72],[5,1,71]]),
           SN(8,[[0,2,64],[2,2,64],[4,2,67],[6,2,65]]), SN(3,[[0,1,72],[1,1,71],[2,1,69]]),
           SN(4,[[0,0.5,81],[0.5,0.5,79],[1,1,76],[2,0.5,81],[2.5,0.5,79],[3,1,77]]), SN(12,[[0,6,57],[6,6,60]])]},
  additive: {inx:1, name:'Additive (after Glass)', base:'minimal',
    settings:{X:0, pulseMs:170, composers:['glass'], philip:0.9, terry:2, pulse:0.3, stay:25, gap:40, wet:0.2, minN:3, maxN:9, mode:{scale:'aeolian'}},
    players:['organ','juno','flute','clarinet','sax','bassoon','violins','viola','bass'],
    seeds:[SN(3,[[0,1,57],[1,1,60],[2,1,64]]), SN(4,[[0,1,57],[1,1,60],[2,1,64],[3,1,60]]), SN(6,[[0,1,53],[1,1,57],[2,1,60],[3,1,57],[4,1,60],[5,1,64]]),
           SN(4,[[0,1,55],[1,1,59],[2,1,62],[3,1,59]]), SN(5,[[0,1,64],[1,1,62],[2,1,60],[3,1,59],[4,1,57]]),
           SN(8,[[0,1,69],[1,1,72],[2,1,76],[3,1,72],[4,1,69],[5,1,72],[6,1,76],[7,1,79]])]},
  loops: {inx:1, name:'Long loops (after Eno)', base:'inc',
    settings:{X:0, pulseMs:420, composers:[], terry:8, pulse:0, stay:90, gap:80, wet:0.5, minN:2, maxN:7, mode:{peakDb:2, flatten:0.7, surprise:0.3}},
    players:['piano2','vibes','juno','cellos','flute','harp','chimes'],
    seeds:[SN(13,[[0,3,72]]), SN(17,[[2,4,69],[9,3,67]]), SN(21,[[0,5,64],[11,6,65]]), SN(23,[[4,8,60]]),
           SN(19,[[0,2,76],[6,3,74],[14,4,72]]), SN(29,[[8,10,55]])]},
  shaker: {inx:1, name:'Shaker (after Adams)', base:'inc',
    settings:{X:0, pulseMs:150, composers:['adams'], john:0.9, terry:3, pulse:0.2, stay:30, gap:30, wet:0.26, minN:3, maxN:5, mode:{scale:'mixolydian'}},
    players:['violins','viola','cellos','bass','psalbow'],
    seeds:[SN(2,[[0,0.5,67],[0.5,0.5,67],[1,0.5,67],[1.5,0.5,67]]),
           SN(4,[[0,0.5,71],[0.5,0.5,72],[1,0.5,71],[1.5,0.5,72],[2,0.5,74],[2.5,0.5,72],[3,0.5,71],[3.5,0.5,72]]),
           SN(8,[[0,8,55]]), SN(3,[[0,1,62],[1,1,67],[2,1,62]]), SN(6,[[0,0.5,79],[0.5,0.5,77],[1,1,79],[3,0.5,79],[3.5,0.5,77],[4,2,74]]),
           SN(16,[[0,8,43],[8,8,50]])]},
  tintinnabuli: {inx:1, name:'Tintinnabuli (after Pärt)', base:'inc',
    settings:{X:0, pulseMs:480, composers:['young'], drone:0.4, terry:2, pulse:0, stay:60, gap:60, wet:0.45, minN:2, maxN:7,
              mode:{scale:'aeolian', peakDb:4, flatten:0.4, surprise:0.2}},
    players:['tubular','piano2','violins','viola','cellos','bass','chimes'],
    seeds:[SN(8,[[0,2,69],[2,2,71],[4,2,72],[6,2,71]]), SN(8,[[0,2,64],[2,2,69],[4,2,72],[6,2,69]]), SN(12,[[0,4,76],[4,4,74],[8,4,72]]),
           SN(12,[[0,4,57],[4,4,60],[8,4,64]]), SN(16,[[0,16,45]]), SN(6,[[0,2,81],[2,2,76],[4,2,72]])]},
  kotekan: {inx:1, name:'Kotekan (Balinese gamelan)', base:'inc',
    settings:{X:0, pulseMs:180, composers:['reich'], steve:0.4, terry:2, pulse:0, stay:25, gap:30, wet:0.3, minN:3, maxN:8, mode:{scale:'phrygian'}},
    players:['saron','gender','balafon','kalimba','mbira','vibes','darbuka','bass'],
    seeds:[SN(4,[[0,0.5,64],[1,0.5,65],[2,0.5,64],[3,0.5,69]]), SN(4,[[0.5,0.5,67],[1.5,0.5,67],[2.5,0.5,71],[3.5,0.5,67]]),
           SN(8,[[0,2,52],[4,2,57]]), SN(4,[[0,0.5,72],[0.5,0.5,71],[1,0.5,69],[1.5,0.5,71],[2,1,72],[3,1,76]]),
           SN(8,[[0,1,64],[2,1,65],[4,1,69],[6,1,65]])]},
  nordic: {inx:1, name:'Nordic (after Kiasmos)', base:'techno',
    settings:{X:0.75, bpm:122, composers:[], terry:2, pulse:0, stay:30, gap:40, wet:0.32, minN:3, maxN:8, evo:0.4,
              mode:{scale:'aeolian', surprise:0.25, peakDb:6},
              kit:{kickDecay:0.38, kickPitch:[150, 46], hatDecay:0.03, openDecay:0.2, clap:'rim', bass:'sub', swing:0.08, pump:0.65, kick:'broken',
                   hatK:[6, 10], percK:[3, 5], elec:0.15, gains:{kick:0.9, hat:0.7, perc:0.9}, prog:[0, 5, 2, 6], hold:8, pad:1, arp:0.8, arpRate:1, tape:0.3}},
    players:['piano2','violins','viola','cellos','bass','juno','harp','handperc'],
    seeds:[SN(8,[[0,2,69],[2,1,72],[3,1,76],[4,4,74]]), SN(4,[[0,1,57],[1,1,64],[2,1,69],[3,1,64]]), SN(16,[[0,8,45],[8,8,52]]),
           SN(6,[[0,1,76],[1,1,74],[2,2,72],[4,2,71]]), SN(8,[[0,3,64],[4,3,67]]), SN(4,[[0,0.5,81],[1,0.5,79],[2,0.5,76],[3,0.5,74]])]},
  analog: {inx:1, name:'Analog (after Rival Consoles)', base:'techno',
    settings:{X:0.8, bpm:118, composers:['reich'], steve:0.4, terry:3, pulse:0, stay:35, gap:44, wet:0.28, minN:3, maxN:8, evo:0.6,
              mode:{scale:'dorian', surprise:0.35, peakDb:7},
              kit:{kickDecay:0.45, kickPitch:[140, 44], hatDecay:0.04, openDecay:0.25, clap:'clap', bass:'sub', swing:0.05, pump:0.55, kick:'broken',
                   hatK:[8, 12], percK:[2, 5], elec:0.9, gains:{clap:0.7}, prog:[0, 3, 6, 2], hold:16, pad:0.8, arp:1, arpRate:1, tape:0.5}},
    players:['prophet','juno','polysix','ms20','moog','m1organ','piano1','congas'],
    seeds:[SN(6,[[0,1,62],[1,1,65],[2,1,69],[3,1,72],[4,1,69],[5,1,65]]), SN(8,[[0,4,50],[4,4,55]]), SN(4,[[0,2,74],[2,1,72],[3,1,69]]),
           SN(12,[[0,6,62],[6,6,60]]), SN(3,[[0,0.5,77],[0.5,0.5,76],[1,1,74],[2,1,72]]), SN(16,[[0,16,38]])]},
  robotik: {inx:1, name:'Robotik (after Kraftwerk)', base:'techno',
    settings:{X:0.85, bpm:116, composers:[], terry:1, pulse:0, stay:20, gap:32, wet:0.08, minN:3, maxN:8, evo:0.25,
              mode:{scale:'aeolian', gridAll:true, flatten:0.6, surprise:0.2, peakDb:5},
              kit:{kickDecay:0.3, kickPitch:[170, 52], hatDecay:0.025, openDecay:0.12, clap:'clap', bass:'octave', swing:0, pump:0.1, kick:'four',
                   hatK:[14, 16], percK:[4, 6], elec:1, gains:{ohat:0.3, perc:1.0, bass:0.75}, prog:[0, 6, 5, 6], hold:4, pad:0.4, arp:0.5, arpRate:1, tape:0}},
    players:['moog','m1organ','prophet','polysix','ms20','juno','glock','bells'],
    seeds:[SN(4,[[0,0.5,57],[1,0.5,57],[2,0.5,69],[3,0.5,57]]), SN(8,[[0,1,76],[1,1,74],[2,1,72],[3,1,74],[4,2,76],[6,2,69]]),
           SN(2,[[0,0.5,81],[0.5,0.5,76],[1,0.5,72],[1.5,0.5,76]]), SN(8,[[0,4,64],[4,4,67]]), SN(4,[[0,1,72],[2,1,71],[3,1,67]]),
           SN(16,[[0,2,69],[4,2,72],[8,2,76],[12,4,74]])]},
};
