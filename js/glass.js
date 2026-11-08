'use strict';
/* Glass additive and subtractive process.
   A pattern's note groups (notes that start together form one group) are its units.
   Stage k plays units 1..k and lasts until unit k+1 would start (the whole pattern at the last stage).
   Additive: 1, 1–2, 1–2–3 … all; subtractive: back down to 1. Each stage repeats a few times. */
function unitsOf(P){ return [...new Set(P.notes.map(n => n.o))].sort((a,b) => a-b); }
function glassView(a, P){
  const G = a.glass; if (!G || G.idx !== a.idx) return P;
  const u = unitsOf(P), k = G.k;
  if (k >= u.length) return P;
  const len = u[k], keep = [];
  P.notes.forEach((n, j) => { if (n.o < len) keep.push(j); });
  return {len, notes:keep.map(j => ({...P.notes[j], d:Math.min(P.notes[j].d, len - P.notes[j].o)})), midi:keep.map(j => P.midi[j]), ex:P.ex};
}
const PHILIP = {amount:0.5};   // 0–1; 0.5 is the original setting: scales how often the process starts and how many players run it at once
function glassCount(){ return E.agents.filter(x => x.glass && !x.removed).length; }
function maybeStartGlass(a){
  const C = ST.glass; if (!C || a.glass || E.gather || phaseActive(a) || a.resting || strictGrid(a)) return false;
  const k = PHILIP.amount/0.5;
  if (glassCount() >= Math.max(1, Math.round(C.maxConcurrent*k)) || Math.random() >= C.chance*k) return false;
  const m = unitsOf(E.gen.get(a.idx)).length;
  if (m < C.minUnits) return false;
  const reps = C.reps[0] + Math.floor(Math.random()*(C.reps[1] - C.reps[0] + 1));
  a.glass = {idx:a.idx, m, k:1, dir:1, reps, left:reps};
  log(`${name(a)} builds pattern ${a.idx} up one note group at a time`);
  return true;
}
/* Called at the player's boundary; the player keeps its pattern while the process runs. */
function glassStep(a){
  const G = a.glass; G.left--;
  if (G.left > 0) return;
  G.left = G.reps;
  if (G.dir > 0){ if (G.k < G.m) G.k++; else { G.dir = -1; G.k = G.m - 1; } }
  else { if (G.k > 1) G.k--; else { a.glass = null; } }
}
function glassLabel(a){ const G = a.glass; return `${G.dir > 0 ? 'additive' : 'subtractive'} ${Math.min(G.k, G.m)}/${G.m}`; }
