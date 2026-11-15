'use strict';
/* Notation: the patterns in play engraved on a staff, In C style (numbered patterns, no bars inside a pattern).
   A pattern is {len, notes:[{o, d, deg}], midi[], f}: pulses are sixteenths, deg is a diatonic step from C4 (its letter is deg mod 7),
   f the key's pitch classes per letter, so the key signature and every accidental follow from f and midi. */
const NOTATION = {on:false, key:'', el:null};
const SP = 7;                        // staff space in px
const HEAD_W = 295/250*SP;           // black notehead width
const VALUES = [16, 12, 8, 6, 4, 3, 2, 1];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
const SHARP_DN = [38, 35, 39, 36, 33, 37, 34], FLAT_DN = [34, 37, 33, 36, 32, 35, 31];   // treble positions; bass is two octaves (14 steps) lower

function glyph(k, x, y, cls){
  const s = SP/250;
  return `<path class="${cls||''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s} ${-s})" d="${GLYPH[k][0]}"/>`;
}
/* split a duration at an onset into notatable values: first up to the next beat, then the largest value that fits */
function chunkDur(o, d){
  const out = [];
  while (d > 0){
    const toBeat = (4 - o % 4) % 4;
    let v = toBeat && d > toBeat ? toBeat : VALUES.find(x => x <= d);
    if (toBeat && d <= toBeat) v = VALUES.find(x => x <= d);
    out.push(v); o += v; d -= v;
  }
  return out;
}
function keySig(f){ const a = {}; for (let j=0;j<7;j++){ const x = f[j] - CMAJ[j]; if (x) a[j] = x; } return a; }
function sigStr(sig){ return Object.keys(sig).sort().map(j => j + ':' + sig[j]).join(','); }

/* one pattern as a list of events: chords (notes sharing an onset, held to the longest of them or the next onset) and rests,
   split into tied values; each head has its staff step dn, letter and accidental */
function patEvents(P){
  const by = new Map();
  P.notes.forEach((n, k) => { if (n.o >= P.len) return; if (!by.has(n.o)) by.set(n.o, []); by.get(n.o).push({d:n.d, deg:n.deg, midi:P.midi[k]}); });
  const ons = [...by.keys()].sort((a, b) => a - b), ev = []; let t = 0;
  const rest = (o, d) => { for (const v of chunkDur(o, d)){ ev.push({rest:true, o, v}); o += v; } };
  ons.forEach((o, k) => {
    if (o > t) rest(t, o - t);
    const grp = by.get(o), next = k + 1 < ons.length ? ons[k+1] : P.len;
    const end = Math.min(next, P.len, o + Math.max(1, ...grp.map(n => n.d)));
    const seen = new Set(), heads = [];
    for (const n of grp){
      const dn = 28 + n.deg; if (seen.has(dn)) continue; seen.add(dn);
      const letter = mod(n.deg, 7);
      heads.push({dn, letter, acc: clamp(n.midi - (60 + 12*Math.floor(n.deg/7) + CMAJ[letter]), -2, 2)});
    }
    heads.sort((a, b) => a.dn - b.dn);
    const parts = chunkDur(o, end - o); let x = o;
    parts.forEach((v, j) => { ev.push({o:x, v, heads: heads.map(h => ({...h})), tie: j < parts.length - 1, cont: j > 0}); x += v; });
    t = end;
  });
  if (t < P.len) rest(t, P.len - t);
  return ev;
}

function engrave(pats, opts){
  const W = Math.max(240, opts.width), clefBass = opts.bass, base = clefBass ? 14 : 0;   // key signatures sit two octaves lower in the bass clef
  const bottomDn = clefBass ? 18 : 30, midDn = bottomDn + 4;   // diatonic step of the bottom line: treble E4, bass G2
  const lineH = 16*SP, top0 = 7*SP;
  const yOf = (dn, row) => top0 + row*lineH + 4*SP - (dn - bottomDn)*SP/2;
  const items = [];   // per pattern: header width + events with widths
  let prevSig = null;
  for (const P of pats){
    const sig = keySig(P.f), ev = patEvents(P);
    const mem = {};       // accidentals within the pattern, as within a bar
    for (const e of ev){
      if (e.rest) { e.w = SP*(1.8 + 0.55*e.v); continue; }
      let nacc = 0;
      for (const h of e.heads){
        const had = h.dn in mem ? mem[h.dn] : (sig[h.letter] || 0);
        h.show = e.cont || h.acc === had ? null : h.acc; if (!e.cont) mem[h.dn] = h.acc;
        if (h.show !== null) nacc++;
      }
      const second = e.heads.some((h, k) => k && h.dn - e.heads[k-1].dn === 1);
      e.pre = nacc*1.25*SP;
      e.w = SP*(1.9 + 0.6*e.v) + e.pre + (second ? HEAD_W : 0) + ((e.v === 3 || e.v === 6 || e.v === 12) ? 0.6*SP : 0);
    }
    const change = prevSig !== null && sigStr(sig) !== sigStr(prevSig);
    items.push({P, sig, ev, change, old:prevSig, w: ev.reduce((a, e) => a + e.w, 0) + 2*SP});
    prevSig = sig;
  }
  const sigW = sig => Object.keys(sig).length*1.1*SP;
  const headW = sig => 2.2*SP + 3.2*SP + sigW(sig) + 0.8*SP;
  // flow into rows; a pattern wider than a whole row is split between beats
  const rows = [[]]; let x = headW(items[0] ? items[0].sig : {}), rowSig = items[0] ? items[0].sig : {};
  const newRow = sig => { rows.push([]); rowSig = sig; x = headW(sig); };
  for (const it of items){
    const chW = it.change ? sigW(it.sig) + sigW(it.old)*0.9 + 1.5*SP : 0;
    if (x + chW + it.w > W && rows[rows.length-1].length) newRow(it.sig);
    let seg = {it, ev:[], first:true, sigNow: it.change && rows[rows.length-1].length > 0};
    rows[rows.length-1].push(seg); if (seg.sigNow) x += chW;
    for (const e of it.ev){
      if (x + e.w > W - SP && seg.ev.length && e.o % 4 === 0){ newRow(it.sig); seg = {it, ev:[], first:false, sigNow:false}; rows[rows.length-1].push(seg); }
      seg.ev.push(e); x += e.w;
    }
    x += 2*SP;
  }
  // draw
  let svg = '';
  const H = rows.length*lineH + 2*SP;
  rows.forEach((row, r) => {
    const y0 = yOf(bottomDn + 8, r), yB = yOf(bottomDn, r);
    for (let k=0;k<5;k++) svg += `<line class="st" x1="0" x2="${W}" y1="${(y0 + k*SP).toFixed(1)}" y2="${(y0 + k*SP).toFixed(1)}"/>`;
    let cx = 0.5*SP;
    svg += clefBass ? glyph('fClef', cx, yB - 3*SP) : glyph('gClef', cx, yB - SP);
    cx += 3.4*SP;
    const firstSig = row.length ? row[0].it.sig : {};
    const drawSig = (sig, old) => {
      const sharps = SHARP_ORDER.filter(j => sig[j] > 0), flats = FLAT_ORDER.filter(j => sig[j] < 0);
      if (old){ for (const j of [...SHARP_ORDER, ...FLAT_ORDER]) if (old[j] && !sig[j] && !(sharps.includes(j) || flats.includes(j))){
        const dn = (old[j] > 0 ? SHARP_DN[SHARP_ORDER.indexOf(j)] : FLAT_DN[FLAT_ORDER.indexOf(j)]) - base;
        svg += glyph('natural', cx, yOf(dn, r)); cx += 0.95*SP; } }
      sharps.forEach(j => { svg += glyph('sharp', cx, yOf(SHARP_DN[SHARP_ORDER.indexOf(j)] - base, r)); cx += 1.1*SP; });
      flats.forEach(j => { svg += glyph('flat', cx, yOf(FLAT_DN[FLAT_ORDER.indexOf(j)] - base, r)); cx += 1.1*SP; });
    };
    drawSig(firstSig, null); cx += 0.8*SP;
    // one height for the row's pattern numbers, clear of its highest stems
    const rowHi = Math.max(-99, ...row.flatMap(sg => sg.ev.filter(e => !e.rest).map(e => e.heads[e.heads.length-1].dn)));
    const ny = Math.max(r*lineH + 3.6*SP, Math.min(y0, yOf(rowHi, r) - 1.4*SP - (rowHi >= midDn - 4 ? 3.3*SP : 0)));
    row.forEach((seg, si) => {
      const it = seg.it, P = it.P, dim = opts.upcoming(P.i) ? ' up' : '', live = opts.live(P.i);
      if (si && seg.first){ svg += `<line class="bar" x1="${(cx - SP).toFixed(1)}" x2="${(cx - SP).toFixed(1)}" y1="${y0}" y2="${yB}"/>`; }
      if (seg.sigNow){ svg += `<line class="bar" x1="${(cx - 0.6*SP).toFixed(1)}" x2="${(cx - 0.6*SP).toFixed(1)}" y1="${y0}" y2="${yB}"/>`; cx += 0.4*SP; drawSig(it.sig, it.old); cx += 0.8*SP; }
      svg += `<g class="pat${dim}">`;
      // place events
      const x0 = cx;
      for (const e of seg.ev){
        const pre = e.rest ? 0 : e.pre; cx += pre;
        e.x = cx; cx += e.w - pre;
        if (!e.rest){ for (const h of e.heads) h.y = yOf(h.dn, r); e.lo = e.heads[0]; e.hi = e.heads[e.heads.length-1]; e.y = e.hi.y; }
      }
      if (seg.first){
        const lab = String(P.i), bw = 6.6*lab.length + 8;
        svg += `<g class="num${live ? ' live' : ''}${dim}"><rect x="${x0.toFixed(1)}" y="${(ny - 3.4*SP).toFixed(1)}" width="${bw}" height="${2.2*SP}" rx="2"/>`
             + `<text x="${(x0 + 4).toFixed(1)}" y="${(ny - 1.75*SP).toFixed(1)}">${lab}</text></g>`;
      }
      // beam groups: consecutive eighths/sixteenths within a beat
      const groups = []; let g = null;
      for (const e of seg.ev){
        const short = !e.rest && e.v < 4;
        if (short && g && Math.floor(e.o/4) === Math.floor(g[0].o/4)) g.push(e);
        else { g = short ? [e] : null; if (g) groups.push(g); }
      }
      for (const e of seg.ev){
        if (e.rest){
          const k = {16:'rW', 12:'rH', 8:'rH', 6:'rQ', 4:'rQ', 3:'r8', 2:'r8', 1:'r16'}[e.v];
          svg += glyph(k, e.x, k === 'rW' ? yB - 3*SP : yB - 2*SP);
          if (e.v === 12 || e.v === 6 || e.v === 3) svg += glyph('dot', e.x + 1.6*SP, yB - 2.5*SP);
          continue;
        }
        e.up = (e.lo.dn + e.hi.dn)/2 < midDn;
        for (const h of e.heads){
          const pos = h.dn - bottomDn, ld = L => { const ly = yOf(bottomDn + L, r).toFixed(1); svg += `<line class="ld" x1="${(e.x - 0.4*SP).toFixed(1)}" x2="${(e.x + HEAD_W + 0.4*SP).toFixed(1)}" y1="${ly}" y2="${ly}"/>`; };
          for (let L = -2; L >= pos; L -= 2) ld(L);
          for (let L = 10; L <= pos; L += 2) ld(L);
        }
      }
      // beamed groups share one stem direction, by the average of all their heads
      const beamed = groups.filter(gr => gr.length > 1), inGroup = new Set();
      for (const gr of beamed){
        const hs = gr.flatMap(e => e.heads), up = hs.reduce((a, h) => a + h.dn, 0)/hs.length < midDn;
        gr.forEach(e => { e.up = up; inGroup.add(e); });
      }
      // heads (a second in a chord puts one head on the other side of the stem), accidentals, dots
      for (const e of seg.ev){
        if (e.rest) continue;
        const hs = e.up ? e.heads : [...e.heads].reverse(); let prev = null;
        for (const h of hs){ h.dx = prev && Math.abs(h.dn - prev.dn) === 1 && !prev.dx ? (e.up ? 1 : -1)*(HEAD_W - 0.1*SP) : 0; prev = h; }
        let ax = e.x - 1.25*SP + Math.min(0, ...e.heads.map(h => h.dx));
        for (const h of [...e.heads].reverse()) if (h.show !== null){ svg += glyph({'-2':'dflat', '-1':'flat', '0':'natural', '1':'sharp', '2':'dsharp'}[h.show], ax, h.y); ax -= 1.25*SP; }
        const dotX = e.x + HEAD_W + Math.max(0, ...e.heads.map(h => h.dx)) + 0.45*SP;
        for (const h of e.heads){
          svg += glyph(e.v === 16 ? 'nhWhole' : e.v >= 8 ? 'nhHalf' : 'nhBlack', e.x + h.dx, h.y);
          if (e.v === 12 || e.v === 6 || e.v === 3) svg += glyph('dot', dotX, h.y - ((h.dn - bottomDn) % 2 === 0 ? SP/2 : 0));
        }
      }
      // stems and flags; beams
      const sxOf = e => e.up ? e.x + HEAD_W - 0.06*SP : e.x + 0.06*SP;
      const stem = (e, yEnd) => { const x = sxOf(e).toFixed(1), y1 = (e.up ? e.lo.y : e.hi.y).toFixed(1); svg += `<line class="stem" x1="${x}" x2="${x}" y1="${y1}" y2="${yEnd.toFixed(1)}"/>`; };
      for (const e of seg.ev){
        if (e.rest || e.v === 16 || inGroup.has(e)) continue;
        const ey = e.up ? e.hi.y - 3.5*SP : e.lo.y + 3.5*SP;
        stem(e, ey);
        if (e.v < 4) svg += glyph((e.v === 1 ? 'f16' : 'f8') + (e.up ? 'u' : 'd'), sxOf(e) - 0.06*SP, ey);
      }
      for (const gr of beamed){
        const up = gr[0].up, t = 0.5*SP, dir = up ? 1 : -1;
        const by = up ? Math.min(...gr.map(e => e.hi.y)) - 3.3*SP : Math.max(...gr.map(e => e.lo.y)) + 3.3*SP;
        gr.forEach(e => stem(e, by));
        const beam = (x1, x2, y) => { svg += `<rect class="beam" x="${x1.toFixed(1)}" y="${(up ? y : y - t).toFixed(1)}" width="${Math.max(1, x2 - x1).toFixed(1)}" height="${t.toFixed(1)}"/>`; };
        beam(sxOf(gr[0]) - 0.06*SP, sxOf(gr[gr.length-1]) + 0.06*SP, by);
        const y2 = by + dir*0.75*SP;
        gr.forEach((e, k) => {
          if (e.v !== 1) return;
          const nx = gr[k+1], pv = gr[k-1];
          if (nx && nx.v === 1) beam(sxOf(e), sxOf(nx), y2);
          else if (!(pv && pv.v === 1)) { if (nx) beam(sxOf(e), sxOf(e) + 1.1*SP, y2); else beam(sxOf(e) - 1.1*SP, sxOf(e), y2); }
        });
      }
      // ties, one per head, on the side away from the stem
      seg.ev.forEach((e, k) => {
        if (e.rest || !e.tie) return;
        const nx = seg.ev[k+1], x1 = e.x + HEAD_W + 0.15*SP, x2 = nx ? nx.x - 0.15*SP : x1 + 2*SP;
        e.heads.forEach((h, j) => {
          const below = e.heads.length > 1 ? j < e.heads.length/2 : e.up;
          const yy = h.y + (below ? 0.7*SP : -0.7*SP), bend = below ? 0.9*SP : -0.9*SP, mx = ((x1 + x2)/2).toFixed(1);
          svg += `<path class="tie" d="M${x1.toFixed(1)} ${yy.toFixed(1)} Q${mx} ${(yy + bend).toFixed(1)} ${x2.toFixed(1)} ${yy.toFixed(1)} Q${mx} ${(yy + bend*0.7).toFixed(1)} ${x1.toFixed(1)} ${yy.toFixed(1)}Z"/>`;
        });
      });
      svg += '</g>';
      cx += 2*SP;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label}">${svg}</svg>`;
}

/* the panel: patterns in play (and the next one, faded), redrawn only when that set changes */
function drawNotation(lo, hi){
  const el = NOTATION.el; if (!NOTATION.on || !el) return;
  if (!E.gen){ if (NOTATION.key !== 'idle'){ NOTATION.key = 'idle'; el.innerHTML = '<p class="hint">The patterns in play will appear here in staff notation.</p>'; } return; }
  const to = Math.min(hi + 1, E.gen.pats.length - 1), pats = [];
  for (let i = Math.max(0, lo); i <= to; i++) if (E.gen.pats[i]) pats.push(E.gen.pats[i]);
  if (!pats.length) return;
  const w = Math.floor(el.clientWidth), all = pats.flatMap(P => P.midi).sort((a, b) => a - b);
  const bass = all.length && all[all.length >> 1] < 55;
  const key = `${lo},${hi},${to},${w},${bass},${pats.map(P => P.len + ':' + P.notes.length).join('.')}`;
  if (key === NOTATION.key) return; NOTATION.key = key;
  el.innerHTML = engrave(pats, {width:w, bass, live:i => i >= lo && i <= hi, upcoming:i => i > hi,
    label:`Patterns ${pats[0].i} to ${pats[pats.length-1].i} in staff notation`});
}
