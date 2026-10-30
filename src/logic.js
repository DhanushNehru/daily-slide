/* Pure game logic: seeded puzzles, solvability, scoring. No DOM, no storage. */
(function (root) {
  'use strict';
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dateKey(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function parseKey(k) { return new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100); }
  function prevKey(k) { var d = parseKey(k); d.setDate(d.getDate() - 1); return dateKey(d); }
  function nextMidnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0); }
  /* getDay(): 0 = Sunday. Mon 3x3 ... Sun 5x5; the days between are a design choice. */
  function sizeForDay(dow) { return { 1: 3, 2: 3, 3: 4, 4: 4, 5: 4, 6: 5, 0: 5 }[dow]; }
  function solvedBoard(n) { var a = []; for (var i = 1; i < n * n; i++) a.push(i); a.push(0); return a; }
  function isSolved(b) { for (var i = 0; i < b.length - 1; i++) if (b[i] !== i + 1) return false; return b[b.length - 1] === 0; }
  function neighbors(n, g) { var r = Math.floor(g / n), c = g % n, o = []; if (r > 0) o.push(g - n); if (c > 0) o.push(g - 1); if (c < n - 1) o.push(g + 1); if (r < n - 1) o.push(g + n); return o; }
  var SCRAMBLE = { 3: 70, 4: 120, 5: 200 };
  function scramble(n, seed) {
    var rnd = mulberry32(seed), b = solvedBoard(n), gap = n * n - 1, last = -1, path = [gap], steps = SCRAMBLE[n] || 100, i = 0;
    while (i < steps || isSolved(b)) {
      var nb = neighbors(n, gap).filter(function (x) { return x !== last; });
      var p = nb[Math.floor(rnd() * nb.length)];
      b[gap] = b[p]; b[p] = 0; last = gap; gap = p; path.push(gap); i++;
    }
    return { board: b, path: path };
  }
  function inversions(b) { var c = 0; for (var i = 0; i < b.length; i++) { if (!b[i]) continue; for (var j = i + 1; j < b.length; j++) if (b[j] && b[i] > b[j]) c++; } return c; }
  function isPermutation(b, n) {
    if (!Array.isArray(b) || b.length !== n * n) return false;
    var seen = {};
    for (var i = 0; i < b.length; i++) { var v = b[i]; if (typeof v !== 'number' || v !== Math.floor(v) || v < 0 || v >= n * n || seen[v]) return false; seen[v] = 1; }
    return true;
  }
  function isSolvable(b, n) { var inv = inversions(b); if (n % 2 === 1) return inv % 2 === 0; var gap = b.indexOf(0), rfb = n - Math.floor(gap / n); return (rfb % 2 === 0) ? (inv % 2 === 1) : (inv % 2 === 0); }
  function manhattan(b, n) { var d = 0; for (var i = 0; i < b.length; i++) { var t = b[i]; if (!t) continue; var gi = t - 1; d += Math.abs(Math.floor(i / n) - Math.floor(gi / n)) + Math.abs(i % n - gi % n); } return d; }
  function parFor(b, n) { return Math.ceil(manhattan(b, n) * 1.6) + n * 2; }
  function starsFor(moves, par) { return moves <= par ? 3 : (moves <= Math.ceil(par * 1.5) ? 2 : 1); }
  /* A tile moves only if it is directly next to the gap (up, down, left or right). One tile per move. */
  function canMove(b, n, i) { var g = b.indexOf(0); return i >= 0 && i < b.length && b[i] !== 0 && neighbors(n, g).indexOf(i) !== -1; }
  function moveTile(b, n, i) { if (!canMove(b, n, i)) return false; var g = b.indexOf(0); b[g] = b[i]; b[i] = 0; return true; }

  /* Progress. `state` is the save object from save.js (v2). */
  function recordWin(state, info) {
    var st = state.stats; st.played++; st.totalMoves += info.moves;
    if (info.daily) {
      var first = state.daily.key !== info.key || !state.daily.solved;
      if (first && st.lastDaily !== info.key) {
        if (info.key > st.lastDaily) st.streak = (st.lastDaily && st.lastDaily === prevKey(info.key)) ? st.streak + 1 : 1;
        if (info.key > st.lastDaily) st.lastDaily = info.key;
        st.dailyDone++; state.totalStars += info.stars;
        if (st.streak > st.bestStreak) st.bestStreak = st.streak;
      }
      state.daily = { key: info.key, solved: true, moves: info.moves, time: info.time, stars: info.stars, size: info.size, progress: null };
    }
    return state;
  }
  function currentStreak(st, todayKey) { return (st.lastDaily && (st.lastDaily === todayKey || st.lastDaily === prevKey(todayKey))) ? st.streak : 0; }
  function avgMoves(st) { return st.played ? Math.round(st.totalMoves / st.played) : 0; }
  function scorePending(state) { return state.totalStars > state.bestScoreSent ? state.totalStars : 0; }
  function fmtTime(ms) { var t = Math.floor(ms / 1000), m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtCountdown(ms) { var t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; function p(x) { return x < 10 ? '0' + x : '' + x; } return p(h) + ':' + p(m) + ':' + p(s); }

  var api = { mulberry32: mulberry32, dateKey: dateKey, parseKey: parseKey, prevKey: prevKey, nextMidnight: nextMidnight, sizeForDay: sizeForDay, solvedBoard: solvedBoard, isSolved: isSolved, neighbors: neighbors, scramble: scramble, isSolvable: isSolvable, isPermutation: isPermutation, manhattan: manhattan, parFor: parFor, starsFor: starsFor, canMove: canMove, moveTile: moveTile, recordWin: recordWin, currentStreak: currentStreak, avgMoves: avgMoves, scorePending: scorePending, fmtTime: fmtTime, fmtCountdown: fmtCountdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
