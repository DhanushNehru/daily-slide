/* Versioned save data: one JSON string, kept small, always sanitised.
   Stored only through Sdk.saveData (see sdk.js). */
(function (root) {
  'use strict';
  var L = (typeof module !== 'undefined' && module.exports) ? require('./logic.js') : root.Logic;
  var CURRENT = 2, MAX_BYTES = 100 * 1024;

  function defaults() {
    return { v: CURRENT, stats: { played: 0, streak: 0, bestStreak: 0, lastDaily: 0, totalMoves: 0, dailyDone: 0 }, totalStars: 0, bestScoreSent: 0, daily: { key: 0, solved: false, moves: 0, time: 0, stars: 0, size: 0, progress: null }, settings: { numbers: true } };
  }
  function int(x, max) { return (typeof x === 'number' && isFinite(x) && x >= 0) ? Math.min(Math.floor(x), max || 1e9) : 0; }
  function validKey(k) { k = int(k); var y = Math.floor(k / 10000), m = Math.floor(k / 100) % 100, d = k % 100; return (y >= 2000 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31) ? k : 0; }
  function cleanProgress(p, key) {
    if (!p || typeof p !== 'object') return null;
    var n = int(p.size); if (n < 3 || n > 5) return null;
    if (!L.isPermutation(p.board, n) || !L.isSolvable(p.board, n) || L.isSolved(p.board)) return null;
    var undo = Array.isArray(p.undo) ? p.undo.filter(function (x) { return typeof x === 'number' && x >= 0 && x < n * n && x === Math.floor(x); }).slice(-200) : [];
    return { size: n, board: p.board.slice(), moves: int(p.moves, 100000), time: int(p.time, 86400000 * 7), undo: undo };
  }
  /* Migrations: each turns version N data into version N+1 data. */
  var migrations = {
    1: function (o) { /* v1 = the pre-release Daily Slide prototype shape (flat stats, a "today" record). That build never shipped on Playables, so no real v1 saves are expected; the step exists so the migration path is tested. */
      var s = defaults();
      s.stats.played = int(o.played); s.stats.streak = int(o.streak); s.stats.bestStreak = Math.max(int(o.bestStreak), s.stats.streak);
      s.stats.lastDaily = validKey(o.lastDaily); s.stats.totalMoves = int(o.totalMoves); s.stats.dailyDone = int(o.dailyDone);
      var t = o.today;
      if (t && typeof t === 'object' && validKey(t.key)) { s.daily = { key: validKey(t.key), solved: true, moves: int(t.moves), time: int(t.time), stars: Math.min(3, int(t.stars)), size: int(t.size), progress: null }; s.totalStars = s.daily.stars; }
      s.v = 2; return s;
    }
  };
  function sanitize(o) {
    var s = defaults(), st = (o && o.stats) || {};
    s.stats.played = int(st.played); s.stats.streak = int(st.streak, 100000); s.stats.bestStreak = Math.max(int(st.bestStreak, 100000), s.stats.streak);
    s.stats.lastDaily = validKey(st.lastDaily); s.stats.totalMoves = int(st.totalMoves); s.stats.dailyDone = int(st.dailyDone);
    s.totalStars = int(o && o.totalStars); s.bestScoreSent = Math.min(int(o && o.bestScoreSent), s.totalStars);
    var d = o && o.daily;
    if (d && typeof d === 'object' && validKey(d.key)) {
      s.daily = { key: validKey(d.key), solved: !!d.solved, moves: int(d.moves), time: int(d.time), stars: Math.min(3, Math.max(0, int(d.stars))), size: int(d.size), progress: d.solved ? null : cleanProgress(d.progress) };
    }
    s.settings.numbers = !(o && o.settings && o.settings.numbers === false);
    return s;
  }
  /* parse(str) -> { state, status } with status ok | empty | migrated | reset */
  function parse(str) {
    if (str === null || str === undefined || str === '') return { state: defaults(), status: 'empty' };
    var o;
    try { o = JSON.parse(str); } catch (e) { return { state: defaults(), status: 'reset' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { state: defaults(), status: 'reset' };
    var v = (typeof o.v === 'number') ? Math.floor(o.v) : ((typeof o.streak === 'number' || typeof o.played === 'number') ? 1 : 0);
    if (v < 1) return { state: defaults(), status: 'reset' };
    var migrated = false;
    /* A save from a NEWER version is read as far as we understand it, but flagged so the game never overwrites it. */
    if (v > CURRENT) { return { state: sanitize(o), status: 'future' }; }
    while (v < CURRENT) { if (!migrations[v]) return { state: defaults(), status: 'reset' }; o = migrations[v](o); v++; migrated = true; }
    return { state: sanitize(o), status: migrated ? 'migrated' : 'ok' };
  }
  function serialize(state) {
    var s = JSON.stringify(state);
    if (s.length > MAX_BYTES) { var c = JSON.parse(s); c.daily.progress = null; s = JSON.stringify(c); }
    return s;
  }
  var api = { CURRENT: CURRENT, MAX_BYTES: MAX_BYTES, defaults: defaults, parse: parse, serialize: serialize, sanitize: sanitize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SaveData = api;
})(typeof window !== 'undefined' ? window : globalThis);
