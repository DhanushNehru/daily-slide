/* Procedural abstract art: gradients and geometric shapes from a seed. */
(function (root) {
  'use strict';
  function draw(c, size, seed) {
    var r = root.Logic.mulberry32(seed ^ 0x9e3779b9), h = Math.floor(r() * 360);
    var g = c.createLinearGradient(0, 0, size, size); g.addColorStop(0, 'hsl(' + h + ',70%,38%)'); g.addColorStop(1, 'hsl(' + ((h + 70) % 360) + ',75%,22%)');
    c.globalAlpha = 1; c.fillStyle = g; c.fillRect(0, 0, size, size);
    for (var i = 0; i < 18; i++) {
      var x = r() * size, y = r() * size, s = size * (0.08 + r() * 0.26), hh = (h + Math.floor(r() * 200) + 20) % 360, a = 0.4 + r() * 0.5, k = Math.floor(r() * 4);
      c.save(); c.globalAlpha = a; c.fillStyle = 'hsl(' + hh + ',75%,' + (45 + Math.floor(r() * 25)) + '%)'; c.strokeStyle = 'hsla(' + hh + ',80%,80%,.9)'; c.lineWidth = size * 0.012; c.translate(x, y); c.rotate(r() * Math.PI);
      c.beginPath();
      if (k === 0) c.arc(0, 0, s / 2, 0, Math.PI * 2);
      else if (k === 1) c.rect(-s / 2, -s / 3, s, s * 0.66);
      else if (k === 2) { c.moveTo(0, -s / 2); c.lineTo(s / 2, s / 2); c.lineTo(-s / 2, s / 2); c.closePath(); }
      else c.arc(0, 0, s / 2, 0, Math.PI * 1.3);
      if (k === 3) c.stroke(); else c.fill();
      c.restore();
    }
    c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#fff'; c.lineWidth = size * 0.01;
    for (var j = 0; j < 4; j++) { c.beginPath(); c.arc(r() * size, r() * size, size * (0.1 + r() * 0.3), 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  root.Art = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
