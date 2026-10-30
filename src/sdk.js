/* Thin wrapper around the YouTube Playables SDK (ytgame).
   Inside Playables every call is forwarded and wrapped in try/catch.
   Anywhere else (ytgame missing or IN_PLAYABLES_ENV false) the same API is
   backed by in-memory stubs. Nothing here ever touches browser storage. */
(function (root) {
  'use strict';
  var yt = (typeof ytgame !== 'undefined' && ytgame && ytgame.IN_PLAYABLES_ENV) ? ytgame : null;
  var firstFrameSent = false, gameReadySent = false, loadedOk = !yt;
  var memData = null;
  var pauseCbs = [], resumeCbs = [], audioCbs = [];

  function logHealth(kind) {
    try { if (yt && yt.health && typeof yt.health[kind] === 'function') yt.health[kind](); } catch (e) { /* best effort */ }
  }
  function safe(fn, fallback) {
    try { return fn(); } catch (e) { logHealth('logError'); return fallback; }
  }
  function asPromise(fn) {
    try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); }
  }

  var Sdk = {
    inPlayables: !!yt,
    firstFrameReady: function () {
      if (firstFrameSent) return;
      firstFrameSent = true;
      safe(function () { if (yt) yt.game.firstFrameReady(); });
    },
    gameReady: function () {
      if (gameReadySent) return;
      gameReadySent = true;
      safe(function () { if (yt) yt.game.gameReady(); });
    },
    /* Resolves { ok: boolean, data: string|null }. Never rejects. */
    loadData: function () {
      if (!yt) return Promise.resolve({ ok: true, data: memData });
      return asPromise(function () { return yt.game.loadData(); }).then(function (d) {
        loadedOk = true;
        return { ok: true, data: (typeof d === 'string' && d.length) ? d : null };
      }, function () {
        logHealth('logWarning');
        return { ok: false, data: null };
      });
    },
    /* Resolves true when stored. Refuses (false) before a successful load. */
    saveData: function (str) {
      if (typeof str !== 'string' || !loadedOk) return Promise.resolve(false);
      if (!yt) { memData = str; return Promise.resolve(true); }
      return asPromise(function () { return yt.game.saveData(str); }).then(function () { return true; }, function () {
        logHealth('logWarning');
        return false;
      });
    },
    sendScore: function (value) {
      var v = Math.floor(value);
      if (!(v >= 0) || !isFinite(v)) return Promise.resolve(false);
      if (!yt) return Promise.resolve(true);
      return asPromise(function () { return yt.engagement.sendScore({ value: v }); }).then(function () { return true; }, function () {
        logHealth('logWarning');
        return false;
      });
    },
    getLanguage: function () {
      if (!yt) return Promise.resolve('en');
      return asPromise(function () { return yt.system.getLanguage(); }).then(function (l) {
        return (typeof l === 'string' && l) ? l : 'en';
      }, function () { logHealth('logWarning'); return 'en'; });
    },
    isAudioEnabled: function () {
      return safe(function () { return yt ? !!yt.system.isAudioEnabled() : true; }, true);
    },
    onAudioEnabledChange: function (cb) {
      audioCbs.push(cb);
      safe(function () { if (yt) yt.system.onAudioEnabledChange(cb); });
    },
    onPause: function (cb) {
      pauseCbs.push(cb);
      safe(function () { if (yt) yt.system.onPause(cb); });
    },
    onResume: function (cb) {
      resumeCbs.push(cb);
      safe(function () { if (yt) yt.system.onResume(cb); });
    },
    logError: function () { logHealth('logError'); },
    logWarning: function () { logHealth('logWarning'); }
  };
  root.Sdk = Sdk;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sdk;
})(typeof window !== 'undefined' ? window : globalThis);
