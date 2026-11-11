/* ===== Moteur Sudoku : solveur, générateur, techniques ===== */
var SE = (function () {
  var ROW = [], COL = [], BOX = [], UNITS = [], PEERS = [], SEES = [];
  for (var i = 0; i < 81; i++) { ROW[i] = Math.floor(i / 9); COL[i] = i % 9; BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3); }
  for (var u = 0; u < 27; u++) UNITS.push([]);
  for (i = 0; i < 81; i++) { UNITS[ROW[i]].push(i); UNITS[9 + COL[i]].push(i); UNITS[18 + BOX[i]].push(i); }
  for (i = 0; i < 81; i++) {
    PEERS[i] = []; SEES[i] = new Array(81).fill(false);
    for (var j = 0; j < 81; j++) if (j !== i && (ROW[i] === ROW[j] || COL[i] === COL[j] || BOX[i] === BOX[j])) { PEERS[i].push(j); SEES[i][j] = true; }
  }
  var ALL = 511;
  function bit(d) { return 1 << (d - 1); }
  function pc(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
  function digits(m) { var r = []; for (var d = 1; d <= 9; d++) if (m & bit(d)) r.push(d); return r; }
  function name(i) { return 'L' + (ROW[i] + 1) + 'C' + (COL[i] + 1); }
  function unitName(u) { return u < 9 ? 'ligne ' + (u + 1) : u < 18 ? 'colonne ' + (u - 8) : 'bloc ' + (u - 17); }
  function laUnit(u) { return (u >= 18 ? 'le ' : 'la ') + unitName(u); }
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---- solveur par retour arrière (compte jusqu'à limit solutions) ---- */
  function solve(grid, limit, rnd) {
    var g = grid.slice(), rows = [0,0,0,0,0,0,0,0,0], cols = rows.slice(), boxes = rows.slice();
    for (var i = 0; i < 81; i++) if (g[i]) {
      var b = bit(g[i]);
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return { count: 0 };
      rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
    }
    var count = 0, first = null;
    function rec() {
      var best = -1, bestM = 0, bestN = 10;
      for (var i = 0; i < 81; i++) if (!g[i]) {
        var m = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]), n = pc(m);
        if (n < bestN) { best = i; bestM = m; bestN = n; if (n <= 1) break; }
      }
      if (best < 0) { count++; if (!first) first = g.slice(); return count >= limit; }
      if (bestN === 0) return false;
      var ds = digits(bestM); if (rnd) shuffle(ds, rnd);
      for (var k = 0; k < ds.length; k++) {
        var d = ds[k], b = bit(d);
        g[best] = d; rows[ROW[best]] |= b; cols[COL[best]] |= b; boxes[BOX[best]] |= b;
        if (rec()) return true;
        rows[ROW[best]] &= ~b; cols[COL[best]] &= ~b; boxes[BOX[best]] &= ~b;
      }
      g[best] = 0; return false;
    }
    rec();
    return { count: count, solution: first };
  }

  /* ---- candidats à partir des valeurs posées ---- */
  function computeCands(vals) {
    var c = new Array(81);
    for (var i = 0; i < 81; i++) {
      if (vals[i]) { c[i] = 0; continue; }
      var m = ALL; var P = PEERS[i];
      for (var k = 0; k < P.length; k++) if (vals[P[k]]) m &= ~bit(vals[P[k]]);
      c[i] = m;
    }
    return c;
  }

  /* ---- techniques ----
     Chaque étape : {tech, level, title, cells:[bleues], keyDigits:{cell:mask}, elim:[[cell,digit]], place:[cell,digit]|null, text} */
  var TECH_NAMES = { nsingle: 'Singleton nu', hsingle: 'Singleton caché', pointing: 'Candidats bloqués (pointage)', claiming: 'Candidats bloqués (ligne/colonne)', npair: 'Paire nue', hpair: 'Paire cachée', ntriple: 'Triplet nu', xwing: 'X-Wing', xywing: 'XY-Wing', wwing: 'W-Wing' };
  var TECH_LEVEL = { nsingle: 1, hsingle: 1, pointing: 2, claiming: 2, npair: 2, hpair: 2, ntriple: 2, xwing: 3, xywing: 3, wwing: 3 };

  function mk(tech, cells, key, elim, place, text) {
    return { tech: tech, level: TECH_LEVEL[tech], title: TECH_NAMES[tech], cells: cells, keyDigits: key || {}, elim: elim || [], place: place || null, text: text };
  }
  function elimFrom(cands, targets, mask, excl) {
    var e = [];
    for (var k = 0; k < targets.length; k++) {
      var t = targets[k]; if (excl && excl.indexOf(t) >= 0) continue;
      var x = cands[t] & mask; if (!x) continue;
      var ds = digits(x); for (var q = 0; q < ds.length; q++) e.push([t, ds[q]]);
    }
    return e;
  }
  function withProof(st, proof) { st.proof = proof; return st; }
  function keyOf(cells, mask) { var k = {}; cells.forEach(function (c) { k[c] = mask; }); return k; }
  function commonPeers(a, b) { var r = []; for (var i = 0; i < 81; i++) if (i !== a && i !== b && SEES[a][i] && SEES[b][i]) r.push(i); return r; }

  function* nakedSingles(v, c) {
    for (var i = 0; i < 81; i++) if (!v[i] && pc(c[i]) === 1) {
      var d = digits(c[i])[0];
      yield mk('nsingle', [i], keyOf([i], c[i]), [], [i, d], 'La case ' + name(i) + ' n’a plus qu’un seul candidat possible : ' + d + '.');
    }
  }
  function* hiddenSingles(v, c) {
    for (var u = 0; u < 27; u++) for (var d = 1; d <= 9; d++) {
      var pos = UNITS[u].filter(function (i) { return c[i] & bit(d); });
      if (pos.length === 1 && pc(c[pos[0]]) > 1) {
        yield mk('hsingle', UNITS[u].filter(function (i) { return !v[i]; }), keyOf(pos, bit(d)), [], [pos[0], d], 'Dans ' + laUnit(u) + ', le ' + d + ' ne peut aller qu’en ' + name(pos[0]) + '.');
      }
    }
  }
  function* locked(v, c) {
    for (var b = 18; b < 27; b++) for (var d = 1; d <= 9; d++) {
      var pos = UNITS[b].filter(function (i) { return c[i] & bit(d); });
      if (pos.length < 2) continue;
      var sameR = pos.every(function (i) { return ROW[i] === ROW[pos[0]]; }), sameC = pos.every(function (i) { return COL[i] === COL[pos[0]]; });
      var lines = [];
      if (sameR) lines.push(ROW[pos[0]]); if (sameC) lines.push(9 + COL[pos[0]]);
      for (var q = 0; q < lines.length; q++) {
        var e = elimFrom(c, UNITS[lines[q]], bit(d), pos);
        if (e.length) yield mk('pointing', pos, keyOf(pos, bit(d)), e, null, 'Dans le ' + unitName(b) + ', le ' + d + ' est forcément sur la ' + unitName(lines[q]) + ' (cases ' + pos.map(name).join(', ') + '). On peut donc l’éliminer du reste de cette ' + (lines[q] < 9 ? 'ligne' : 'colonne') + '.');
      }
    }
    for (var u = 0; u < 18; u++) for (d = 1; d <= 9; d++) {
      var p2 = UNITS[u].filter(function (i) { return c[i] & bit(d); });
      if (p2.length < 2) continue;
      if (p2.every(function (i) { return BOX[i] === BOX[p2[0]]; })) {
        var bx = 18 + BOX[p2[0]];
        var e2 = elimFrom(c, UNITS[bx], bit(d), p2);
        if (e2.length) yield mk('claiming', p2, keyOf(p2, bit(d)), e2, null, 'Sur ' + laUnit(u) + ', le ' + d + ' est forcément dans le ' + unitName(bx) + ' (cases ' + p2.map(name).join(', ') + '). On peut l’éliminer du reste du bloc.');
      }
    }
  }
  function* subsets(v, c) {
    for (var u = 0; u < 27; u++) {
      var empt = UNITS[u].filter(function (i) { return !v[i] && c[i]; });
      // paire nue
      for (var a = 0; a < empt.length; a++) for (var b = a + 1; b < empt.length; b++) {
        var x = empt[a], y = empt[b];
        if (pc(c[x]) === 2 && c[x] === c[y]) {
          var e = elimFrom(c, empt, c[x], [x, y]);
          if (e.length) yield mk('npair', [x, y], keyOf([x, y], c[x]), e, null, 'Les cases ' + name(x) + ' et ' + name(y) + ' ne contiennent que ' + digits(c[x]).join(' et ') + ' : ces deux chiffres leur sont réservés dans ' + laUnit(u) + '.');
        }
      }
      // paire cachée
      for (var d1 = 1; d1 <= 9; d1++) for (var d2 = d1 + 1; d2 <= 9; d2++) {
        var p1 = empt.filter(function (i) { return c[i] & bit(d1); }), q2 = empt.filter(function (i) { return c[i] & bit(d2); });
        if (p1.length === 2 && q2.length === 2 && p1[0] === q2[0] && p1[1] === q2[1]) {
          var m = bit(d1) | bit(d2);
          var e3 = elimFrom(c, p1, ALL & ~m);
          if (e3.length) yield mk('hpair', p1, keyOf(p1, m), e3, null, 'Dans ' + laUnit(u) + ', ' + d1 + ' et ' + d2 + ' ne peuvent aller qu’en ' + name(p1[0]) + ' et ' + name(p1[1]) + ' : les autres candidats de ces deux cases disparaissent.');
        }
      }
      // triplet nu
      for (a = 0; a < empt.length; a++) for (b = a + 1; b < empt.length; b++) for (var k = b + 1; k < empt.length; k++) {
        var cs = [empt[a], empt[b], empt[k]], um = c[cs[0]] | c[cs[1]] | c[cs[2]];
        if (pc(um) === 3 && cs.every(function (i) { return pc(c[i]) >= 2; })) {
          var e4 = elimFrom(c, empt, um, cs);
          if (e4.length) yield mk('ntriple', cs, keyOf(cs, um), e4, null, 'Les cases ' + cs.map(name).join(', ') + ' se partagent les seuls chiffres ' + digits(um).join(', ') + ' dans ' + laUnit(u) + '.');
        }
      }
    }
  }
  function* xwing(v, c) {
    for (var d = 1; d <= 9; d++) for (var t = 0; t < 2; t++) {
      // t=0 : base lignes, couverture colonnes ; t=1 : l'inverse
      var base = t === 0 ? 0 : 9, cover = t === 0 ? COL : ROW;
      var lists = [];
      for (var l = 0; l < 9; l++) lists.push(UNITS[base + l].filter(function (i) { return c[i] & bit(d); }));
      for (var a = 0; a < 9; a++) for (var b = a + 1; b < 9; b++) {
        var A = lists[a], B = lists[b];
        if (A.length !== 2 || B.length !== 2) continue;
        if (cover[A[0]] !== cover[B[0]] || cover[A[1]] !== cover[B[1]]) continue;
        var cells = [A[0], A[1], B[0], B[1]];
        var cu1 = (t === 0 ? 9 : 0) + cover[A[0]], cu2 = (t === 0 ? 9 : 0) + cover[A[1]];
        var e = elimFrom(c, UNITS[cu1].concat(UNITS[cu2]), bit(d), cells);
        var tx = e.length ? e[0][0] : 0, inFirst = cover[tx] === cover[A[0]];
        var cA = inFirst ? A[0] : A[1], cB = inFirst ? B[0] : B[1], oA = inFirst ? A[1] : A[0], oB = inFirst ? B[1] : B[0];
        var pfx = 'Pour le vérifier en mode Hypothèse : pose un ' + d + ' en ' + name(tx) + '. Le ' + d + ' disparaît de ' + name(cA) + ' et ' + name(cB) + '. Les ' + (t === 0 ? 'lignes ' : 'colonnes ') + (a + 1) + ' et ' + (b + 1) + ' n\u2019ont alors plus qu\u2019une place chacune pour le ' + d + ' : ' + name(oA) + ' et ' + name(oB) + '. Mais ces deux cases sont sur la même ' + (t === 0 ? 'colonne' : 'ligne') + ' : deux ' + d + ' alignés, contradiction.';
        if (e.length) yield withProof(mk('xwing', cells, keyOf(cells, bit(d)), e, null,
          'Sur les ' + (t === 0 ? 'lignes ' : 'colonnes ') + (a + 1) + ' et ' + (b + 1) + ', le ' + d + ' n’a que deux places, alignées sur les mêmes ' + (t === 0 ? 'colonnes ' : 'lignes ') + (cover[A[0]] + 1) + ' et ' + (cover[A[1]] + 1) + '. Le ' + d + ' occupe donc forcément deux coins opposés du rectangle : on l’élimine du reste de ces ' + (t === 0 ? 'colonnes.' : 'lignes.')), pfx);
      }
    }
  }
  function* xywing(v, c) {
    var bv = []; for (var i = 0; i < 81; i++) if (!v[i] && pc(c[i]) === 2) bv.push(i);
    for (var p = 0; p < bv.length; p++) {
      var piv = bv[p], ab = digits(c[piv]);
      var wings = bv.filter(function (w) { return w !== piv && SEES[piv][w] && pc(c[w] & c[piv]) === 1; });
      for (var x = 0; x < wings.length; x++) for (var y = x + 1; y < wings.length; y++) {
        var w1 = wings[x], w2 = wings[y];
        var sh1 = c[w1] & c[piv], sh2 = c[w2] & c[piv];
        if (sh1 === sh2) continue;
        var z1 = c[w1] & ~c[piv], z2 = c[w2] & ~c[piv];
        if (z1 !== z2) continue;
        var z = digits(z1)[0];
        var e = elimFrom(c, commonPeers(w1, w2), z1, [piv]);
        if (e.length) {
          var key = {}; key[piv] = c[piv]; key[w1] = c[w1]; key[w2] = c[w2];
          var ty = e[0][0], a1 = digits(sh1)[0], b2 = digits(sh2)[0];
          var py = 'Pour le vérifier en mode Hypothèse : pose un ' + z + ' en ' + name(ty) + '. Les deux pinces voient cette case et perdent le ' + z + ' : ' + name(w1) + ' devient ' + a1 + ' et ' + name(w2) + ' devient ' + b2 + '. Le pivot ' + name(piv) + ' voit les deux pinces : il ne peut plus valoir ni ' + a1 + ' ni ' + b2 + ', il n\u2019a plus aucun candidat. Contradiction.';
          yield withProof(mk('xywing', [piv, w1, w2], key, e, null, 'Pivot ' + name(piv) + ' {' + ab.join(',') + '}, pinces ' + name(w1) + ' {' + digits(c[w1]).join(',') + '} et ' + name(w2) + ' {' + digits(c[w2]).join(',') + '}. Quel que soit le chiffre du pivot, l’une des deux pinces vaut ' + z + ' : toute case qui voit les deux pinces ne peut pas contenir ' + z + '.'), py);
        }
      }
    }
  }
  function* wwing(v, c) {
    var bv = []; for (var i = 0; i < 81; i++) if (!v[i] && pc(c[i]) === 2) bv.push(i);
    for (var p = 0; p < bv.length; p++) for (var q = p + 1; q < bv.length; q++) {
      var A = bv[p], B = bv[q];
      if (c[A] !== c[B] || SEES[A][B]) continue;
      var ds = digits(c[A]);
      for (var k = 0; k < 2; k++) {
        var lk = ds[k], el = ds[1 - k];
        var targets = commonPeers(A, B).filter(function (t) { return c[t] & bit(el); });
        if (!targets.length) continue;
        for (var u = 0; u < 27; u++) {
          var pos = UNITS[u].filter(function (i) { return c[i] & bit(lk); });
          if (pos.length !== 2 || pos.indexOf(A) >= 0 || pos.indexOf(B) >= 0) continue;
          var L1 = pos[0], L2 = pos[1], ok = false;
          if (SEES[A][L1] && SEES[B][L2]) ok = true; else if (SEES[A][L2] && SEES[B][L1]) { var tt = L1; L1 = L2; L2 = tt; ok = true; }
          if (!ok) continue;
          var e = elimFrom(c, targets, bit(el));
          var key = {}; key[A] = c[A]; key[B] = c[B]; key[L1] = bit(lk); key[L2] = bit(lk);
          var tw = e[0][0];
          var pw = 'Pour le vérifier en mode Hypothèse : pose un ' + el + ' en ' + name(tw) + '. Cette case voit ' + name(A) + ' et ' + name(B) + ', qui perdent le ' + el + ' et deviennent toutes les deux ' + lk + '. Alors ' + name(L1) + ' (qui voit ' + name(A) + ') et ' + name(L2) + ' (qui voit ' + name(B) + ') perdent le ' + lk + ' : ' + laUnit(u) + ' n\u2019a plus aucune place pour le ' + lk + '. La contradiction ne se voit pas comme une case vide : regarde où le ' + lk + ' peut encore aller dans ' + laUnit(u) + '.';
          yield withProof(mk('wwing', [A, B, L1, L2], key, e, null, 'Les cases ' + name(A) + ' et ' + name(B) + ' contiennent toutes deux {' + ds.join(',') + '}. Dans ' + laUnit(u) + ', le ' + lk + ' n’a que deux places (' + name(L1) + ' et ' + name(L2) + '), et chacune voit l’une des deux cases. L’une de ' + name(A) + ' ou ' + name(B) + ' vaut donc forcément ' + el + ' : on élimine ' + el + ' des cases qui voient les deux.'), pw);
        }
      }
    }
  }
  var FINDERS = [nakedSingles, hiddenSingles, locked, subsets, xwing, xywing, wwing];

  /* filter(step) -> bool permet d'écarter les étapes (ex : éliminations incorrectes) */
  function findStep(v, c, opts) {
    opts = opts || {};
    for (var f = 0; f < FINDERS.length; f++) {
      var it = FINDERS[f](v, c);
      for (var s = it.next(); !s.done; s = it.next()) {
        var st = s.value;
        if (opts.minLevel && st.level < opts.minLevel) break;
        if (opts.only && opts.only.indexOf(st.tech) < 0) continue;
        if (opts.filter && !opts.filter(st)) continue;
        return st;
      }
    }
    return null;
  }
  function applyStep(v, c, st) {
    if (st.place) {
      var i = st.place[0], d = st.place[1];
      v[i] = d; c[i] = 0;
      PEERS[i].forEach(function (p) { c[p] &= ~bit(d); });
    }
    st.elim.forEach(function (e) { c[e[0]] &= ~bit(e[1]); });
  }

  /* ---- notation : résout logiquement, renvoie le niveau max et les techniques utilisées ---- */
  function grade(puzzle) {
    var v = puzzle.slice(), c = computeCands(v), used = {}, maxL = 0, steps = 0;
    while (true) {
      if (v.every(function (x) { return x; })) return { solved: true, level: maxL, used: used, steps: steps };
      var st = findStep(v, c);
      if (!st) return { solved: false, level: 9, used: used, steps: steps };
      used[st.tech] = (used[st.tech] || 0) + 1; if (st.level > maxL) maxL = st.level;
      applyStep(v, c, st); steps++;
    }
  }

  function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function makePuzzle(rnd) {
    var sol = solve(new Array(81).fill(0), 1, rnd).solution;
    var p = sol.slice(), order = shuffle(Array.from({ length: 41 }, function (_, i) { return i; }), rnd);
    for (var k = 0; k < order.length; k++) {
      var i = order[k], j = 80 - i, a = p[i], b = p[j];
      p[i] = 0; p[j] = 0;
      if (solve(p, 2).count !== 1) { p[i] = a; p[j] = b; }
    }
    return { puzzle: p, solution: sol };
  }
  /* target : 'facile' | 'moyen' | 'difficile' | 'xwing' | 'xywing' | 'wwing' */
  function matches(g, target) {
    if (!g.solved) return false;
    if (target === 'facile') return g.level === 1;
    if (target === 'moyen') return g.level === 2;
    if (target === 'difficile') return g.level === 3;
    return !!g.used[target];
  }
  function generate(target, seed, maxMs) {
    var rnd = mulberry(seed || (Math.random() * 1e9) | 0), t0 = Date.now(), tries = 0, best = null;
    while (true) {
      tries++;
      var pz = makePuzzle(rnd), g = grade(pz.puzzle);
      pz.grade = g; pz.tries = tries;
      if (matches(g, target)) { pz.ok = true; return pz; }
      if (g.solved && (!best || g.level > best.grade.level)) best = pz;
      if (maxMs && Date.now() - t0 > maxMs) { (best || pz).ok = false; return best || pz; }
    }
  }

  return { ROW: ROW, COL: COL, BOX: BOX, UNITS: UNITS, PEERS: PEERS, SEES: SEES, bit: bit, pc: pc, digits: digits, name: name,
    solve: solve, computeCands: computeCands, findStep: findStep, applyStep: applyStep, grade: grade, generate: generate, TECH_NAMES: TECH_NAMES, TECH_LEVEL: TECH_LEVEL };
})();
if (typeof module !== 'undefined') module.exports = SE;
