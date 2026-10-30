#!/usr/bin/env node
/* Builds dist/daily-slide.zip with index.html at the ZIP root.
   Usage: node tools/build.js      (Node 18+, no dependencies)
   It also checks the bundle against the file rules in the official stability requirements. */
'use strict';
var fs = require('fs'), path = require('path'), zlib = require('zlib');
var root = path.resolve(__dirname, '..'), src = path.join(root, 'src'), dist = path.join(root, 'dist');
var FILES = ['index.html', 'style.css', 'sdk.js', 'strings.js', 'logic.js', 'save.js', 'audio.js', 'art.js', 'ui.js', 'game.js'];
var problems = [];

function crc32(buf) { var c, crc = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xFF; for (var k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function zip(entries) {
  var local = [], central = [], offset = 0;
  entries.forEach(function (e) {
    var name = Buffer.from(e.name), comp = zlib.deflateRawSync(e.data), crc = crc32(e.data);
    var h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(e.data.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, name, comp);
    var c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(e.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += h.length + name.length + comp.length;
  });
  var cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(local.concat([cd, end]));
}

var entries = FILES.map(function (f) {
  var p = path.join(src, f);
  if (!fs.existsSync(p)) { problems.push('missing file: ' + f); return null; }
  var data = fs.readFileSync(p);
  if (!/^[A-Za-z0-9_.-]+$/.test(f)) problems.push('bad file name: ' + f);
  if (data.length >= 512 * 1024) problems.push('file over 512 KiB (recommended limit): ' + f);
  return { name: f, data: data };
}).filter(Boolean);

var html = fs.existsSync(path.join(src, 'index.html')) ? fs.readFileSync(path.join(src, 'index.html'), 'utf8') : '';
var scripts = html.match(/<script[^>]*src="[^"]+"/g) || [];
if (!scripts.length || scripts[0].indexOf('https://www.youtube.com/game_api/v1') === -1) problems.push('the YouTube SDK script must be the first script in index.html');
(html.match(/(?:src|href)="[^"]+"/g) || []).forEach(function (a) {
  var u = a.replace(/^(?:src|href)="|"$/g, '');
  if (u === 'https://www.youtube.com/game_api/v1') return;
  if (/^(?:[a-z]+:)?\/\//i.test(u) || u.charAt(0) === '/') problems.push('absolute or external reference: ' + u);
  else if (FILES.indexOf(u) === -1) problems.push('referenced file is not in the bundle: ' + u);
});
entries.forEach(function (e) { if (/\.(js|css|html)$/.test(e.name) && /localStorage|sessionStorage|document\.cookie|indexedDB|visibilitychange|navigator\.language/.test(e.data.toString())) problems.push('forbidden API in ' + e.name); });

if (problems.length) { console.error('BUILD FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
fs.mkdirSync(dist, { recursive: true });
var out = path.join(dist, 'daily-slide.zip'), buf = zip(entries);
fs.writeFileSync(out, buf);
var total = entries.reduce(function (s, e) { return s + e.data.length; }, 0);
console.log('Wrote ' + out + ' (' + buf.length + ' bytes zipped, ' + total + ' bytes unzipped, ' + entries.length + ' files, index.html at the root).');
console.log('Next: run the official test suite and upload through the Playables Developer Portal. This build has not been through either.');
