/* DOM access, responsive layout, modal dialogs and board rendering. No game rules here. */
(function (root) {
  'use strict';
  var doc = root.document, T = function (k, v) { return root.I18n.t(k, v); };
  var el = {};
  ['app', 'boot', 'hud', 'boardwrap', 'board', 'tools', 'menu', 'modal', 'modal-box', 'live', 'v-mode', 'v-modelbl', 'v-moves', 'v-time', 'v-par', 'b-undo', 'b-peek', 'b-nums', 'b-menu', 'm-today', 'm-today-main', 'm-today-sub', 'm-stats', 'm-streak', 'm-practice-lbl', 'm-note'].forEach(function (id) { el[id] = doc.getElementById(id); });
  var ctx = el.board.getContext('2d');
  var art = doc.createElement('canvas'); art.width = art.height = 480;
  var artCtx = art.getContext('2d');
  var boardPx = 0, dpr = 1;
  var spacer = doc.createElement('div'); spacer.style.cssText = 'position:absolute;left:0;width:1px;height:1px;top:0;pointer-events:none'; el.app.appendChild(spacer);

  function applyStrings() {
    var i, n = doc.querySelectorAll('[data-i18n]');
    for (i = 0; i < n.length; i++) n[i].textContent = T(n[i].getAttribute('data-i18n'));
    el['m-practice-lbl'].textContent = T('practiceLabel');
    var sb = doc.querySelectorAll('.size-btn');
    for (i = 0; i < sb.length; i++) { var z = +sb[i].getAttribute('data-size'); sb[i].textContent = T('sizeBtn', { size: z }); sb[i].setAttribute('aria-label', T('practiceMode', { size: z })); }
    doc.title = T('appTitle');
    el['b-nums'].setAttribute('aria-label', T('numbers'));
    el['b-peek'].setAttribute('aria-label', T('peekAria'));
  }

  /* Layout: pick portrait (HUD above, tools below) or landscape (HUD left, tools right),
     whichever gives the larger square board. Panels reflow into rows or columns as needed. */
  function layout(boardVisible) {
    var W = el.app.clientWidth, H = el.app.clientHeight;
    var s = Math.max(1, Math.min(1.7, Math.min(W, H) / 480));
    el.app.style.setProperty('--s', s.toFixed(3));
    if (!boardVisible) return;
    var iw = Math.round(76 * s), ih = Math.max(44, Math.round(46 * s)), g = 6, p = Math.max(4, Math.round(8 * s)), n = 4;
    var iwP = iw;
    if (Math.floor((W - 2 * p + g) / (iw + g)) < 4) { var alt = Math.floor((W - 2 * p - 3 * g) / 4); if (alt >= 46) iwP = alt; }
    var perRow = Math.max(1, Math.floor((W - 2 * p + g) / (iwP + g))), cols = Math.min(n, perRow), rows = Math.ceil(n / cols);
    var phP = rows * ih + (rows - 1) * g, bP = Math.min(W - 2 * p, H - 2 * phP - 4 * p);
    var perCol = Math.max(1, Math.floor((H - 2 * p + g) / (ih + g))), rowsL = Math.min(n, perCol), colsL = Math.ceil(n / rowsL);
    var pwL = colsL * iw + (colsL - 1) * g, bL = Math.min(H - 2 * p, W - 2 * pwL - 4 * p);
    var land = bL > bP || (bL === bP && W > H), B = Math.floor(land ? bL : bP), hud = el.hud, tools = el.tools, bw = el.boardwrap;
    /* Very small viewport: stack HUD, board and tools at their normal sizes (44px targets kept) and let the game area scroll. */
    var gn = (root.__dailySlide && root.__dailySlide.G && root.__dailySlide.G.size) || 4, minB = 44 * gn;
    var compact = B < Math.max(120, minB);
    el.app.classList.toggle('scroll', compact);
    if (compact) { land = false; B = Math.max(minB, Math.min(W - 2 * p, 160)); }
    B = Math.max(40, B);
    spacer.style.top = '0px'; spacer.style.left = '0px';
    var ph, pw, x, y;
    [hud, tools].forEach(function (pn) { pn.style.gridAutoRows = ih + 'px'; pn.style.gap = g + 'px'; });
    if (land) {
      var ph2 = rowsL * ih + (rowsL - 1) * g, top = Math.round((H - ph2) / 2);
      [hud, tools].forEach(function (pn) { pn.style.gridTemplateColumns = 'repeat(' + colsL + ',1fr)'; pn.style.width = pwL + 'px'; pn.style.height = ph2 + 'px'; pn.style.top = top + 'px'; });
      hud.style.left = p + 'px'; tools.style.left = (W - p - pwL) + 'px';
      x = p + pwL + p + Math.round((W - 2 * pwL - 4 * p - B) / 2); y = Math.round((H - B) / 2);
    } else {
      [hud, tools].forEach(function (pn) { pn.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)'; pn.style.width = (W - 2 * p) + 'px'; pn.style.height = phP + 'px'; pn.style.left = p + 'px'; });
      hud.style.top = p + 'px'; tools.style.top = (H - p - phP) + 'px';
      x = Math.max(p, Math.round((W - B) / 2)); y = p + phP + p + (compact ? 0 : Math.round((H - 2 * phP - 4 * p - B) / 2));
      if (compact) { tools.style.top = (y + B + p) + 'px'; spacer.style.top = (y + B + p + phP + p - 1) + 'px'; spacer.style.left = Math.max(0, x + B + p - 1) + 'px'; } else { spacer.style.top = '0px'; }
    }
    bw.style.left = x + 'px'; bw.style.top = y + 'px'; bw.style.width = B + 'px'; bw.style.height = B + 'px';
    dpr = root.devicePixelRatio || 1; boardPx = B;
    el.board.style.width = B + 'px'; el.board.style.height = B + 'px';
    el.board.width = Math.round(B * dpr); el.board.height = Math.round(B * dpr);
    return B;
  }

  function renderArt(seed) { root.Art.draw(artCtx, 480, seed); }

  /* tiles: array of {x, y} per tile value (cell units, may be fractional while animating). */
  function drawBoard(n, tiles, board, opts) {
    var W = el.board.width, c = ctx, cell = W / n, pad = Math.max(1, Math.round(W * 0.006)), r = cell * 0.1, v, i;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0c0c18'; c.fillRect(0, 0, W, W);
    if (opts.solved || opts.peek) {
      c.drawImage(art, 0, 0, 480, 480, 0, 0, W, W);
      if (opts.peek && !opts.solved) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, W, W); }
      if (opts.numbers && opts.peek && !opts.solved) label(c, n, cell, null);
      if (opts.solved) { c.strokeStyle = '#ffd24a'; c.lineWidth = pad * 3; c.strokeRect(pad * 1.5, pad * 1.5, W - pad * 3, W - pad * 3); }
      return;
    }
    for (v = 1; v < n * n; v++) {
      var t = tiles[v], px = t.x * cell, py = t.y * cell, hv = v - 1, sx = (hv % n) * 480 / n, sy = Math.floor(hv / n) * 480 / n, sw = 480 / n;
      c.save(); rrect(c, px + pad, py + pad, cell - 2 * pad, cell - 2 * pad, r); c.clip();
      c.drawImage(art, sx, sy, sw, sw, px + pad, py + pad, cell - 2 * pad, cell - 2 * pad);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, pad); rrect(c, px + pad, py + pad, cell - 2 * pad, cell - 2 * pad, r); c.stroke();
      if (opts.numbers) {
        var fs = Math.round(cell * 0.3), bx = px + pad * 3, by = py + pad * 3, bw = fs * (v > 9 ? 1.5 : 1.1), bh = fs * 1.2;
        c.fillStyle = 'rgba(10,10,30,.78)'; rrect(c, bx, by, bw, bh, bh * 0.28); c.fill();
        c.fillStyle = '#ffffff'; c.font = '700 ' + fs + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(v), bx + bw / 2, by + bh / 2 + fs * 0.04);
      }
    }
  }
  function label(c, n, cell) {
    var fs = Math.round(cell * 0.3); c.font = '700 ' + fs + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var v = 1; v < n * n; v++) { var hv = v - 1; c.fillStyle = 'rgba(10,10,30,.78)'; c.fillRect((hv % n) * cell + cell * 0.04, Math.floor(hv / n) * cell + cell * 0.04, fs * 1.4, fs * 1.2); c.fillStyle = '#fff'; c.fillText(String(v), (hv % n) * cell + cell * 0.04 + fs * 0.7, Math.floor(hv / n) * cell + cell * 0.04 + fs * 0.62); }
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  /* Modal: build content from plain strings (textContent only), returns the box. */
  var lastFocus = null, openedAt = 0;
  /* The tap that finishes a puzzle also produces a click on whatever is under the finger, which is now the dialog. Ignore clicks right after it opens. */
  el.modal.addEventListener('click', function (e) { if (root.performance.now() - openedAt < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
  function openModal(title, build) {
    var box = el['modal-box']; while (box.firstChild) box.removeChild(box.firstChild);
    var h = doc.createElement('h2'); h.id = 'modal-title'; h.textContent = title; box.appendChild(h);
    build(box);
    lastFocus = doc.activeElement;
    openedAt = root.performance.now();
    el.modal.classList.remove('hidden');
    var f = box.querySelector('button'); if (f) f.focus();
  }
  function closeModal() { el.modal.classList.add('hidden'); var box = el['modal-box']; while (box.firstChild) box.removeChild(box.firstChild); if (lastFocus && lastFocus.focus && doc.body.contains(lastFocus) && lastFocus.offsetParent !== null) { try { lastFocus.focus(); } catch (e) { /* ignore */ } } lastFocus = null; }
  function mk(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function announce(msg) { el.live.textContent = ''; el.live.textContent = msg; }
  function setText(node, txt) { if (node.textContent !== txt) node.textContent = txt; }
  function isModalOpen() { return !el.modal.classList.contains('hidden'); }

  root.UI = { el: el, applyStrings: applyStrings, layout: layout, renderArt: renderArt, drawBoard: drawBoard, openModal: openModal, closeModal: closeModal, isModalOpen: isModalOpen, mk: mk, announce: announce, setText: setText, boardSize: function () { return boardPx; } };
})(window);
