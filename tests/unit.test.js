/* Run: node tests/unit.test.js   (pure logic, save and score rules; no browser needed) */
'use strict';
var L = require('../src/logic.js'), S = require('../src/save.js'), assert = require('assert'), n = 0;
function ok(c, m) { n++; assert.ok(c, m); }
function eq(a, b, m) { n++; assert.deepStrictEqual(a, b, m); }

/* sizes per weekday (0 = Sunday) */
eq([1, 2, 3, 4, 5, 6, 0].map(L.sizeForDay), [3, 3, 4, 4, 4, 5, 5], 'weekday sizes');

/* date keys */
eq(L.dateKey(new Date(2026, 9, 30, 23, 59)), 20261030); eq(L.prevKey(20260301), 20260228); eq(L.prevKey(20270101), 20261231);
eq(L.nextMidnight(new Date(2026, 9, 30, 23, 59, 59)).getDate(), 31);

/* scramble: deterministic, solvable, never solved, every step is an adjacent move */
for (var size = 3; size <= 5; size++) {
  for (var seed = 1; seed <= 3000; seed++) {
    var a = L.scramble(size, seed), b = L.scramble(size, seed);
    eq(a.board, b.board); ok(L.isPermutation(a.board, size)); ok(L.isSolvable(a.board, size), 'solvable ' + size + ' ' + seed); ok(!L.isSolved(a.board));
    if (seed % 300 === 0) {
      var bd = L.solvedBoard(size);
      for (var k = 1; k < a.path.length; k++) { var g = bd.indexOf(0); ok(L.neighbors(size, g).indexOf(a.path[k]) !== -1, 'path step adjacent'); ok(L.moveTile(bd, size, a.path[k])); }
      eq(bd, a.board, 'replaying path gives the board');
      for (var r = a.path.length - 1; r >= 1; r--) ok(L.moveTile(bd, size, a.path[r - 1]));
      ok(L.isSolved(bd), 'reverse path solves');
    }
  }
}
/* different dates give different boards */
ok(L.scramble(4, 20261030).board.join() !== L.scramble(4, 20261031).board.join());

/* moves: only the 4 neighbours of the gap move, one tile per move */
(function () {
  var b = L.solvedBoard(4); // gap at 15
  for (var i = 0; i < 16; i++) { var c = b.slice(), m = L.moveTile(c, 4, i); ok(m === (i === 11 || i === 14), 'only adjacent moves ' + i); if (m) { var changed = 0; for (var j = 0; j < 16; j++) if (c[j] !== b[j]) changed++; eq(changed, 2, 'exactly one tile moved'); } }
  ok(!L.canMove(b, 4, 15) && !L.canMove(b, 4, -1) && !L.canMove(b, 4, 16));
  /* a tile in the same row but 2 cells away does NOT slide */
  var c2 = b.slice(); ok(!L.moveTile(c2, 4, 13)); eq(c2, b);
})();

/* par and stars */
ok(L.parFor(L.scramble(4, 5).board, 4) > 0); eq(L.starsFor(10, 10), 3); eq(L.starsFor(15, 10), 2); eq(L.starsFor(16, 10), 1);

/* progress: streaks and stars */
(function () {
  var s = S.defaults();
  L.recordWin(s, { daily: true, key: 20261028, moves: 30, time: 1000, stars: 3, size: 4 });
  L.recordWin(s, { daily: true, key: 20261029, moves: 30, time: 1000, stars: 2, size: 4 });
  eq([s.stats.streak, s.totalStars, s.stats.dailyDone], [2, 5, 2]);
  L.recordWin(s, { daily: true, key: 20261029, moves: 5, time: 10, stars: 3, size: 4 }); /* same day again: no extra stars */
  eq([s.stats.streak, s.totalStars, s.stats.dailyDone], [2, 5, 2], 'no double count');
  L.recordWin(s, { daily: false, key: 0, moves: 20, time: 10, stars: 3, size: 3 }); eq(s.totalStars, 5, 'practice stars never count');
  L.recordWin(s, { daily: true, key: 20261101, moves: 30, time: 1, stars: 1, size: 5 }); eq(s.stats.streak, 1, 'gap resets streak'); eq(s.stats.bestStreak, 2);
  eq(L.currentStreak(s.stats, 20261101), 1); eq(L.currentStreak(s.stats, 20261102), 1); eq(L.currentStreak(s.stats, 20261104), 0);
  eq(L.scorePending(s), 6); s.bestScoreSent = 6; eq(L.scorePending(s), 0);
})();

/* save: round trip, defaults, corrupt, future, migrations, bounds */
(function () {
  var d = S.defaults(); eq(S.parse(S.serialize(d)).status, 'ok'); eq(S.parse(S.serialize(d)).state, d);
  eq(S.parse(null).status, 'empty'); eq(S.parse('').status, 'empty');
  ['{bad', '[]', '"x"', '3', 'null', '{"v":0}', '{"v":"2"}', '{}'].forEach(function (x) { var r = S.parse(x); ok(r.status === 'reset' || r.status === 'ok', x); eq(r.state.v, 2); ok(r.state.stats.played === 0); });
  /* future version: understood fields kept, flagged */
  var f = S.parse(JSON.stringify({ v: 7, stats: { played: 4, streak: 2, bestStreak: 3, lastDaily: 20261030 }, totalStars: 9, bestScoreSent: 9, brandNew: { x: 1 } }));
  eq(f.status, 'future'); eq(f.state.totalStars, 9); eq(f.state.stats.played, 4);
  /* v1 prototype shape migrates */
  var m = S.parse(JSON.stringify({ played: 5, streak: 3, bestStreak: 4, lastDaily: 20261029, totalMoves: 200, dailyDone: 3, today: { key: 20261029, moves: 30, time: 2000, stars: 2, size: 4 } }));
  eq(m.status, 'migrated'); eq(m.state.stats.streak, 3); eq(m.state.totalStars, 2); eq(m.state.v, 2);
  /* hostile numbers */
  var h = S.parse(JSON.stringify({ v: 2, stats: { played: -5, streak: 'x', bestStreak: 1e99, lastDaily: 99999999, totalMoves: null }, totalStars: 5, bestScoreSent: 500, daily: { key: 20261030, solved: false, stars: 99, progress: { size: 3, board: [1, 1, 2, 3, 4, 5, 6, 7, 0], moves: 5 } } }));
  eq(h.state.stats.played, 0); eq(h.state.stats.lastDaily, 0); ok(h.state.stats.bestStreak <= 100000); eq(h.state.bestScoreSent, 5, 'bestScoreSent never above totalStars'); eq(h.state.daily.progress, null, 'bad board dropped'); eq(h.state.daily.stars, 3);
  /* unsolvable / solved progress boards are dropped, a valid one is kept */
  var sc = L.scramble(3, 11), good = { v: 2, daily: { key: 20261030, solved: false, progress: { size: 3, board: sc.board, moves: 7, time: 1234, undo: [1, 2, 99, 'a'] } } };
  var pg = S.parse(JSON.stringify(good)).state.daily.progress; eq(pg.board, sc.board); eq(pg.undo, [1, 2]); eq(pg.time, 1234);
  var uns = sc.board.slice(); var i1 = uns.findIndex(function (v) { return v === 1; }), i2 = uns.findIndex(function (v) { return v === 2; }); uns[i1] = 2; uns[i2] = 1;
  eq(S.parse(JSON.stringify({ v: 2, daily: { key: 20261030, progress: { size: 3, board: uns } } })).state.daily.progress, null, 'unsolvable dropped');
  /* size */
  var big = S.defaults(); big.daily = { key: 20261030, solved: false, moves: 0, time: 0, stars: 0, size: 5, progress: { size: 5, board: L.scramble(5, 3).board, moves: 1, time: 1, undo: new Array(200).fill(3) } };
  ok(S.serialize(big).length < S.MAX_BYTES && S.serialize(big).length < 4096, 'save is small: ' + S.serialize(big).length);
  /* idempotent */
  var st = S.parse(S.serialize(big)).state; eq(S.parse(S.serialize(st)).state, st);
})();
console.log('unit tests passed: ' + n + ' assertions');
