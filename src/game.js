/* Game flow: boot sequence, input, timer, pause, saving and score. */
(function (root) {
  'use strict';
  var L = root.Logic, S = root.SaveData, Sdk = root.Sdk, I18n = root.I18n, UI = root.UI, A = root.GameAudio, el = UI.el;
  var t = function (k, v) { return I18n.t(k, v); };
  var perf = root.performance;

  var G = {
    state: S.defaults(), saveEnabled: true, saveNote: '', paused: false, screen: 'boot',
    mode: null, size: 0, board: null, tiles: null, moves: 0, undo: [], acc: 0, runStart: null, wasRunning: false,
    won: false, puzzleKey: 0, par: 0, todayKey: 0, peek: false, dirty: true, raf: 0, last: 0,
    pendingBoot: null, pendingReady: false, layoutDirty: false, booted: false, lastCountdown: -1, lastSec: -1, lastRollCheck: 0
  };

  /* ---------- saving (coalesced, never on unload) ---------- */
  var saving = false, latest = null, waiters = [];
  function snapshot() {
    var st = G.state;
    if (G.mode === 'daily' && G.board && !G.won && !(st.daily.key === G.puzzleKey && st.daily.solved)) {
      st.daily = { key: G.puzzleKey, solved: false, moves: 0, time: 0, stars: 0, size: G.size, progress: { size: G.size, board: G.board.slice(), moves: G.moves, time: Math.floor(elapsed()), undo: G.undo.slice(-200) } };
    }
    return S.serialize(st);
  }
  function persist() {
    if (!G.saveEnabled) return Promise.resolve(false);
    latest = snapshot();
    return new Promise(function (res) { waiters.push(res); if (!saving) flush(); });
  }
  var deferredFlush = false;
  function flush() {
    if (G.paused) { deferredFlush = true; return; } /* no SDK calls while paused */
    saving = true; var batch = waiters; waiters = []; var str = latest;
    Sdk.saveData(str).then(function (ok) { batch.forEach(function (w) { w(ok); }); }, function () { batch.forEach(function (w) { w(false); }); }).then(function () {
      saving = false; if (waiters.length) flush();
    });
  }
  /* Score: best cumulative total, sent only after the matching save succeeded. */
  var sending = false, deferredScore = false;
  function trySendScore() {
    if (!G.saveEnabled || sending) return;
    if (G.paused) { deferredScore = true; return; }
    var target = G.state.totalStars;
    if (!(target > G.state.bestScoreSent)) return;
    sending = true;
    Sdk.sendScore(target).then(function (ok) {
      sending = false;
      if (ok) { if (target > G.state.bestScoreSent) G.state.bestScoreSent = target; persist().then(function () { trySendScore(); }); }
    });
  }
  function saveAndScore() { return persist().then(function (ok) { if (ok) trySendScore(); return ok; }); }

  /* ---------- time ---------- */
  function now() { return perf.now(); }
  function elapsed() { return G.acc + (G.runStart !== null ? now() - G.runStart : 0); }
  function stopTimer() { if (G.runStart !== null) { G.acc += now() - G.runStart; G.runStart = null; } }

  /* ---------- puzzle ---------- */
  function todaySize() { return L.sizeForDay(L.parseKey(G.todayKey).getDay()); }
  function initTiles() {
    var n = G.size; G.tiles = []; for (var v = 0; v < n * n; v++) G.tiles.push({ x: 0, y: 0 });
    for (var i = 0; i < G.board.length; i++) { var val = G.board[i]; if (val) { G.tiles[val].x = i % n; G.tiles[val].y = Math.floor(i / n); } }
  }
  function startPuzzle(mode, size) {
    G.mode = mode; G.size = size; G.won = false; G.peek = false; G.undo = []; G.moves = 0; G.acc = 0; G.runStart = null; G.wasRunning = false;
    var seed, key = 0;
    if (mode === 'daily') {
      key = G.todayKey; G.puzzleKey = key; seed = key;
      var sc = L.scramble(size, seed); G.par = L.parFor(sc.board, size); G.board = sc.board.slice();
      var d = G.state.daily;
      if (d.key === key && !d.solved && d.progress && d.progress.size === size) { G.board = d.progress.board.slice(); G.moves = d.progress.moves; G.acc = d.progress.time; G.undo = d.progress.undo.slice(); }
    } else {
      G.puzzleKey = 0; seed = Math.floor(Math.random() * 2147483647) + 1;
      var sp = L.scramble(size, seed); G.par = L.parFor(sp.board, size); G.board = sp.board.slice();
    }
    UI.renderArt(mode === 'daily' ? key : seed);
    initTiles();
    showScreen('play');
    refreshHud(true);
    G.dirty = true;
    UI.announce(t('announceStart', { mode: modeLabel(), size: size }));
    var cv = el.board; cv.setAttribute('aria-label', t('boardLabel', { size: size }));
    cv.focus({ preventScroll: true }); el.app.scrollTop = 0;
  }
  function modeLabel() { return G.mode === 'daily' ? t('daily', { size: G.size }) : t('practiceMode', { size: G.size }); }

  function tryMove(i) {
    if (G.paused || G.won || G.screen !== 'play' || UI.isModalOpen()) return false;
    var n = G.size, tile = G.board[i], gapBefore = G.board.indexOf(0);
    if (!L.moveTile(G.board, n, i)) return false;
    G.undo.push(gapBefore); if (G.undo.length > 200) G.undo.shift(); /* the tile now sits where the gap was */
    G.moves++; if (G.peek) setPeek(false);
    if (G.runStart === null) G.runStart = now();
    A.slide();
    UI.announce(t('announceMove', { tile: tile, moves: G.moves }));
    refreshHud(false); G.dirty = true;
    if (L.isSolved(G.board)) win(); else if (G.mode === 'daily') persist();
    return true;
  }
  function undo() {
    if (G.paused || G.won || G.screen !== 'play' || UI.isModalOpen() || !G.undo.length) return;
    var cell = G.undo.pop();
    if (!L.moveTile(G.board, G.size, cell)) { refreshHud(false); return; }
    G.moves = Math.max(0, G.moves - 1); G.dirty = true; refreshHud(false);
    if (G.mode === 'daily') persist();
  }

  function win() {
    stopTimer(); G.won = true;
    var time = Math.floor(elapsed()), stars = L.starsFor(G.moves, G.par), daily = G.mode === 'daily';
    var before = G.state.totalStars;
    L.recordWin(G.state, { daily: daily, key: G.puzzleKey, moves: G.moves, time: time, stars: stars, size: G.size });
    A.win();
    UI.announce(t('announceSolved', { moves: G.moves, stars: stars }));
    G.dirty = true; refreshHud(true);
    saveAndScore();
    showResults({ daily: daily, moves: G.moves, time: time, stars: stars, size: G.size, par: G.par, gained: G.state.totalStars - before });
  }

  /* ---------- screens ---------- */
  function showScreen(name) {
    G.screen = name;
    ['hud', 'boardwrap', 'tools'].forEach(function (id) { el[id].classList.toggle('hidden', name !== 'play'); });
    el.menu.classList.toggle('hidden', name !== 'menu');
    el.boot.classList.add('hidden');
    UI.closeModal();
    if (name === 'play') { UI.layout(true); }
    G.dirty = true;
  }
  function rolled() { return L.dateKey(new Date()) !== G.todayKey; }
  function showMenu() {
    G.mode = null; G.board = null; G.todayKey = L.dateKey(new Date());
    showScreen('menu'); UI.layout(false); renderMenu(); G.lastCountdown = -1;
    var b = el['m-today']; if (!root.document.activeElement || root.document.activeElement === root.document.body) b.focus();
  }
  function renderMenu() {
    var st = G.state, d = st.daily, sz = todaySize(), solved = d.key === G.todayKey && d.solved;
    var streak = L.currentStreak(st.stats, G.todayKey);
    UI.setText(el['m-streak'], streak > 0 ? t('streakLine', { n: streak }) : t('streakNone'));
    UI.setText(el['m-note'], G.saveNote);
    if (solved) { UI.setText(el['m-today-main'], t('todaySolved')); }
    else { UI.setText(el['m-today-main'], t('todayPuzzle')); }
    menuSub();
  }
  function menuSub() {
    var st = G.state, d = st.daily, sz = todaySize(), solved = d.key === G.todayKey && d.solved, txt;
    if (solved) txt = t('todayNext', { time: L.fmtCountdown(L.nextMidnight(new Date()) - new Date()) });
    else if (d.key === G.todayKey && d.progress) txt = t('todayResume', { moves: d.progress.moves });
    else txt = t('todayInfo', { size: sz });
    UI.setText(el['m-today-sub'], txt);
  }
  function showResults(r) {
    UI.openModal(t('solved'), function (box) {
      var stars = UI.mk('div', 'stars'); stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', t('starsLabel', { n: r.stars }));
      for (var i = 0; i < 3; i++) { var s = UI.mk('span', i < r.stars ? '' : 'off', '\u2605'); stars.appendChild(s); }
      box.appendChild(stars);
      box.appendChild(UI.mk('p', 'line', t('moves') + ': ' + r.moves + '  |  ' + t('par') + ': ' + r.par + '  |  ' + t('time') + ': ' + L.fmtTime(r.time)));
      if (r.daily) {
        box.appendChild(UI.mk('p', 'line', t('streakLine', { n: L.currentStreak(G.state.stats, G.puzzleKey) }) + '  |  ' + t('totalStars') + ': ' + G.state.totalStars));
        box.appendChild(UI.mk('p', 'line', t('dailyDoneNote')));
        var cd = UI.mk('p', 'line', ''); cd.id = 'res-cd'; box.appendChild(cd); G.lastCountdown = -1; G.cdNode = cd;
      }
      var b = UI.mk('div', 'btns');
      if (rolled()) { var nb = UI.mk('button', 'primary', t('playToday')); nb.type = 'button'; nb.addEventListener('click', function () { G.todayKey = L.dateKey(new Date()); var dd = G.state.daily; startPuzzle('daily', todaySize()); }); b.appendChild(nb); }
      var pr = UI.mk('button', rolled() ? '' : 'primary', t('practiceAnother')); pr.type = 'button';
      pr.addEventListener('click', function () { G.cdNode = null; startPuzzle('practice', r.size); }); b.appendChild(pr);
      var mn = UI.mk('button', '', t('menu')); mn.type = 'button'; mn.addEventListener('click', function () { G.cdNode = null; showMenu(); }); b.appendChild(mn);
      box.appendChild(b);
    });
  }
  function showStats() {
    var st = G.state.stats;
    UI.openModal(t('yourStats'), function (box) {
      var g = UI.mk('div', 'grid2');
      [[t('gamesPlayed'), st.played], [t('dailyStreak'), L.currentStreak(st, G.todayKey)], [t('bestStreak'), st.bestStreak], [t('avgMoves'), L.avgMoves(st)], [t('totalStars'), G.state.totalStars]].forEach(function (r) { g.appendChild(UI.mk('span', '', r[0])); g.appendChild(UI.mk('b', '', String(r[1]))); });
      box.appendChild(g);
      var b = UI.mk('div', 'btns'), c = UI.mk('button', 'primary', t('close')); c.type = 'button'; c.addEventListener('click', UI.closeModal); b.appendChild(c); box.appendChild(b);
    });
  }
  function showSolvedToday() {
    var d = G.state.daily;
    showResultsStatic({ moves: d.moves, par: 0, time: d.time, stars: d.stars });
  }
  function showResultsStatic(r) {
    UI.openModal(t('solvedAlready'), function (box) {
      var stars = UI.mk('div', 'stars'); stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', t('starsLabel', { n: r.stars }));
      for (var i = 0; i < 3; i++) stars.appendChild(UI.mk('span', i < r.stars ? '' : 'off', '\u2605'));
      box.appendChild(stars);
      box.appendChild(UI.mk('p', 'line', t('moves') + ': ' + r.moves + '  |  ' + t('time') + ': ' + L.fmtTime(r.time)));
      box.appendChild(UI.mk('p', 'line', t('dailyDoneNote')));
      var cd = UI.mk('p', 'line', ''); box.appendChild(cd); G.cdNode = cd; G.lastCountdown = -1;
      var b = UI.mk('div', 'btns'), c = UI.mk('button', 'primary', t('close')); c.type = 'button'; c.addEventListener('click', function () { G.cdNode = null; UI.closeModal(); }); b.appendChild(c); box.appendChild(b);
    });
  }

  function refreshHud(force) {
    UI.setText(el['v-modelbl'], G.mode === 'daily' ? t('modeDaily') : t('modePractice'));
    UI.setText(el['v-mode'], G.mode ? t('sizeBtn', { size: G.size }) : '');
    UI.setText(el['v-moves'], String(G.moves));
    UI.setText(el['v-par'], String(G.par));
    UI.setText(el['v-time'], L.fmtTime(elapsed()));
    el['b-undo'].disabled = !G.undo.length || G.won;
    el['b-nums'].setAttribute('aria-pressed', String(G.state.settings.numbers));
  }
  function setPeek(on) { G.peek = on; el['b-peek'].setAttribute('aria-pressed', String(on)); G.dirty = true; if (on) UI.announce(t('peekOn')); }

  /* ---------- frame loop (the only recurring driver: no setInterval, no setTimeout) ---------- */
  function frame(ts) {
    G.raf = 0;
    if (G.paused) return;
    try {
      var dt = Math.min(50, Math.max(0, ts - G.last)); G.last = ts;
      if (G.screen === 'play' && G.tiles) {
        var n = G.size, k = 1 - Math.exp(-dt / 55), moving = false;
        for (var i = 0; i < G.board.length; i++) {
          var v = G.board[i]; if (!v) continue; var tl = G.tiles[v], tx = i % n, ty = Math.floor(i / n);
          if (tl.x !== tx || tl.y !== ty) {
            tl.x += (tx - tl.x) * k; tl.y += (ty - tl.y) * k;
            if (Math.abs(tx - tl.x) < 0.004) tl.x = tx; if (Math.abs(ty - tl.y) < 0.004) tl.y = ty;
            moving = true;
          }
        }
        if (moving) G.dirty = true;
        if (G.runStart !== null) { var sec = Math.floor(elapsed() / 1000); if (sec !== G.lastSec) { G.lastSec = sec; UI.setText(el['v-time'], L.fmtTime(elapsed())); } }
        if (G.dirty) { G.dirty = false; UI.drawBoard(n, G.tiles, G.board, { numbers: G.state.settings.numbers, peek: G.peek, solved: G.won && !moving }); }
      }
      var nowMs = Date.now(), cs = Math.floor(nowMs / 1000);
      if (cs !== G.lastCountdown) {
        G.lastCountdown = cs;
        var left = L.fmtCountdown(L.nextMidnight(new Date(nowMs)) - nowMs);
        if (G.cdNode) UI.setText(G.cdNode, t('nextDaily', { time: left }));
        if (G.screen === 'menu') { if (rolled()) { G.todayKey = L.dateKey(new Date()); renderMenu(); } else menuSub(); }
      }
    } catch (e) { Sdk.logError(); }
    G.raf = root.requestAnimationFrame(frame);
  }
  function startLoop() { if (!G.raf && !G.paused) { G.last = perf.now(); G.raf = root.requestAnimationFrame(frame); } }

  /* ---------- pause / resume: only via the SDK ---------- */
  function onPause() {
    if (G.paused) return;
    /* The docs recommend saving on pause: start one save before freezing (progress is already saved after every change). */
    G.wasRunning = G.runStart !== null; stopTimer();
    if (G.mode === 'daily' && G.board && !G.won) persist();
    G.paused = true;
    if (G.raf) { root.cancelAnimationFrame(G.raf); G.raf = 0; }
    A.suspend();
  }
  function onResume() {
    if (!G.paused) return;
    G.paused = false;
    A.resume();
    if (deferredFlush) { deferredFlush = false; if (!saving) { if (waiters.length) flush(); } }
    if (deferredScore) { deferredScore = false; trySendScore(); }
    if (G.wasRunning && G.screen === 'play' && !G.won) G.runStart = now();
    G.wasRunning = false;
    if (G.pendingBoot) { var b = G.pendingBoot; G.pendingBoot = null; boot(b); }
    else if (G.screen === 'menu' && rolled()) { G.todayKey = L.dateKey(new Date()); renderMenu(); }
    if (G.pendingReady) { G.pendingReady = false; ready(); }
    UI.layout(G.screen === 'play'); G.dirty = true; G.layoutDirty = false; G.lastCountdown = -1;
    startLoop();
  }

  /* ---------- input ---------- */
  function cellAt(ev) {
    var r = el.board.getBoundingClientRect(), n = G.size;
    var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
    return Math.floor(y * n) * n + Math.floor(x * n);
  }
  var ptr = null;
  function moveInDir(dr, dc, startCell) {
    var n = G.size, g = G.board.indexOf(0), gr = Math.floor(g / n), gc = g % n;
    var tr = gr - dr, tc = gc - dc; /* the tile that moves in direction (dr,dc) sits on the opposite side of the gap */
    if (tr < 0 || tc < 0 || tr >= n || tc >= n) return false;
    var idx = tr * n + tc;
    if (startCell >= 0 && startCell !== idx && L.canMove(G.board, n, startCell)) return false; /* swiped a movable tile in a direction it cannot go */
    return tryMove(idx, true);
  }
  function onPointerDown(ev) {
    if (G.paused || G.screen !== 'play' || G.won || UI.isModalOpen() || !ev.isPrimary) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ptr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, cell: cellAt(ev) };
    try { el.board.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    ev.preventDefault();
  }
  function onPointerUp(ev) {
    if (!ptr || ptr.id !== ev.pointerId) return;
    var p = ptr; ptr = null;
    if (G.paused || G.screen !== 'play' || G.won || UI.isModalOpen()) return;
    var dx = ev.clientX - p.x, dy = ev.clientY - p.y, ad = Math.max(Math.abs(dx), Math.abs(dy)), cellPx = UI.boardSize() / G.size;
    if (ad < Math.min(12, cellPx * 0.25)) { if (p.cell >= 0) tryMove(p.cell, true); }
    else if (Math.abs(dx) > Math.abs(dy)) moveInDir(0, dx > 0 ? 1 : -1, p.cell);
    else moveInDir(dy > 0 ? 1 : -1, 0, p.cell);
    ev.preventDefault();
  }
  function onPointerCancel(ev) { if (ptr && ptr.id === ev.pointerId) ptr = null; }
  function onKey(ev) {
    if (G.paused || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'Escape' && UI.isModalOpen()) { G.cdNode = null; UI.closeModal(); return; } /* never preventDefault on Esc */
    if (G.screen !== 'play' || G.won || UI.isModalOpen()) return;
    var d = null;
    if (ev.key === 'ArrowLeft') d = [0, -1]; else if (ev.key === 'ArrowRight') d = [0, 1]; else if (ev.key === 'ArrowUp') d = [-1, 0]; else if (ev.key === 'ArrowDown') d = [1, 0];
    if (!d) return;
    ev.preventDefault();
    moveInDir(d[0], d[1], -1);
  }

  /* ---------- boot ---------- */
  function ready() { if (G.paused) { G.pendingReady = true; return; } Sdk.gameReady(); }
  function boot(res) {
    if (G.booted) return; G.booted = true;
    var parsed;
    if (!res || res.timeout || !res.load || !res.load.ok) { parsed = { state: S.defaults(), status: 'failed' }; G.saveEnabled = false; G.saveNote = t('saveNoteFailed'); }
    else {
      parsed = S.parse(res.load.data);
      if (parsed.status === 'future') { G.saveEnabled = false; G.saveNote = t('saveNoteFuture'); }
      else if (parsed.status === 'reset') { G.saveNote = t('saveNoteReset'); }
    }
    G.state = parsed.state;
    if (res && res.lang) { I18n.setLanguage(res.lang); root.document.documentElement.lang = I18n.resolved(); }
    if (!G.saveEnabled && parsed.status === 'failed') { /* keep note */ }
    UI.applyStrings();
    G.todayKey = L.dateKey(new Date());
    showMenu();
    root.requestAnimationFrame(function () { ready(); });
    startLoop();
    if (parsed.status === 'migrated' || parsed.status === 'reset') persist();
    trySendScore();
  }

  function init() {
    A.setEnabled(Sdk.isAudioEnabled());
    Sdk.onPause(onPause); Sdk.onResume(onResume);
    Sdk.onAudioEnabledChange(function (on) { A.setEnabled(on); });
    UI.layout(false);

    var cv = el.board;
    cv.addEventListener('pointerdown', onPointerDown); cv.addEventListener('pointerup', onPointerUp); cv.addEventListener('pointercancel', onPointerCancel);
    root.document.addEventListener('keydown', onKey);
    root.document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.document.addEventListener('selectstart', function (e) { e.preventDefault(); });
    root.document.addEventListener('dragstart', function (e) { e.preventDefault(); });
    var unlock = function () { A.unlock(); };
    root.document.addEventListener('pointerdown', unlock, true); root.document.addEventListener('keydown', unlock, true);
    root.addEventListener('resize', function () { if (G.paused) { G.layoutDirty = true; return; } UI.layout(G.screen === 'play'); G.dirty = true; });
    root.addEventListener('error', function () { Sdk.logError(); });
    root.addEventListener('unhandledrejection', function () { Sdk.logError(); });

    el['b-undo'].addEventListener('click', undo);
    el['b-peek'].addEventListener('click', function () { if (!G.paused && G.screen === 'play' && !G.won) setPeek(!G.peek); });
    el['b-nums'].addEventListener('click', function () { if (G.paused) return; G.state.settings.numbers = !G.state.settings.numbers; refreshHud(false); G.dirty = true; persist(); });
    el['b-menu'].addEventListener('click', function () { if (G.paused) return; stopTimer(); var wasDaily = G.mode === 'daily' && !G.won; if (wasDaily) persist(); showMenu(); });
    el['m-today'].addEventListener('click', function () {
      if (G.paused) return;
      var d = G.state.daily; if (d.key === G.todayKey && d.solved) showSolvedToday(); else startPuzzle('daily', todaySize());
    });
    var sbs = root.document.querySelectorAll('.size-btn');
    for (var i = 0; i < sbs.length; i++) sbs[i].addEventListener('click', function (e) { if (!G.paused) startPuzzle('practice', +e.currentTarget.getAttribute('data-size')); });
    el['m-stats'].addEventListener('click', function () { if (!G.paused) showStats(); });

    var done = false;
    function finish(r) { if (done) return; done = true; if (G.paused) G.pendingBoot = r; else boot(r); }
    /* The loading splash is already in the HTML. Report the first frame once it has been painted, then load the save. */
    root.requestAnimationFrame(function () {
      root.requestAnimationFrame(function () {
        Sdk.firstFrameReady();
        Promise.all([Sdk.loadData(), Sdk.getLanguage()]).then(function (a) { finish({ load: a[0], lang: a[1] }); });
        root.setTimeout(function () { finish({ timeout: true }); }, 4000);
      });
    });
  }

  root.__dailySlide = { G: G, persist: persist };
  init();
})(window);
