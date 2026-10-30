/* Tiny synthesized sound effects. The AudioContext is only created after a user gesture,
   and nothing plays unless the YouTube audio setting is on. No in-game mute button. */
(function (root) {
  'use strict';
  var ctx = null, enabled = true, paused = false, unlocked = false;
  function ensure() {
    if (!unlocked) return null;
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { if (!ctx) ctx = new AC(); } catch (e) { return null; }
    return ctx;
  }
  function tone(f, d, type, vol, when) {
    if (!enabled || paused) return;
    var c = ensure(); if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      var t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* ignore */ }
  }
  root.GameAudio = {
    unlock: function () { unlocked = true; if (ctx && ctx.state === 'suspended' && enabled && !paused) { try { ctx.resume(); } catch (e) { /* ignore */ } } },
    setEnabled: function (on) { enabled = !!on; if (!enabled && ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
    suspend: function () { paused = true; if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
    resume: function () { paused = false; if (ctx && enabled && unlocked && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } } },
    slide: function () { tone(220 + Math.random() * 40, 0.07, 'triangle', 0.05); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.28, 'sine', 0.07, i * 0.11); }); },
    isCreated: function () { return !!ctx; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
