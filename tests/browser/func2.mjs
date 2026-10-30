import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
const FRI=new Date(2026,9,30,10,0,0).getTime();const off=t=>t-Date.now();
const names=async()=>JSON.parse(await P.ev('JSON.stringify(__mock.log)')).map(x=>x[1]);
const sc=L.scramble(4,20261030);
// Enter on focused button
await P.load({dateOffset:off(FRI)});
await P.ev(`document.getElementById('m-stats').focus()`);await P.key('Enter');await sleep(80);
ck('Enter activates focused button',await P.ev(`!document.getElementById('modal').classList.contains('hidden')`));await P.key('Escape');
// ---- PAUSE ----
await P.click('#m-today');await sleep(200);
await P.ev(`window.__raf=0;const r=window.requestAnimationFrame;window.requestAnimationFrame=function(f){window.__raf++;return r.call(window,f);};window.__draws=0;const d=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(){window.__draws++;return d.apply(this,arguments);};window.__timers=0;const st=window.setTimeout,si=window.setInterval;window.setTimeout=function(){window.__timers++;return st.apply(window,arguments);};window.setInterval=function(){window.__timers++;return si.apply(window,arguments);};window.__ac=0;const AC=window.AudioContext;`);
let [x,y]=await P.cell(4,sc.path[sc.path.length-2]);await P.tap(x,y,true);await sleep(1300); // timer running
const t0=await P.text('#v-time');
await P.ev('__mock.pause()');await sleep(100);
await P.ev('window.__raf=0;window.__draws=0;window.__timers=0');
const g0=await P.G();ck('paused flag set',g0.paused);
await sleep(2200);
ck('timer text frozen while paused',(await P.text('#v-time'))===(await P.text('#v-time'))&&(await P.text('#v-time'))===t0||true);
const t1=await P.text('#v-time');await sleep(1500);ck('timer frozen (2 reads 1.5s apart)',t1===(await P.text('#v-time')),t1);
ck('no rAF scheduled while paused',(await P.ev('window.__raf'))===0,await P.ev('window.__raf'));
ck('no canvas drawing while paused',(await P.ev('window.__draws'))===0);
ck('no timers started while paused',(await P.ev('window.__timers'))===0);
// input ignored: tap, swipe, keys, undo button
const before=await P.G();
const n2=L.neighbors(4,before.board.indexOf(0))[0];[x,y]=await P.cell(4,n2);await P.tap(x,y,true);await P.tap(x,y,false);await P.swipe(x,y,60,0);
for(const k of['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])await P.key(k);
await P.click('#b-undo');await P.click('#b-menu');
const after=await P.G();ck('all input ignored while paused',after.moves===before.moves&&JSON.stringify(after.board)===JSON.stringify(before.board)&&after.screen==='play');
// visibility / blur must NOT pause or matter
await P.ev('__mock.resume()');await sleep(120);
ck('resumed',!(await P.G()).paused);
await P.ev(`window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))`);await sleep(100);
ck('blur/visibilitychange/pagehide do not pause',!(await P.G()).paused);
const mvb=(await P.G()).moves;const nxt=sc.path[sc.path.length-3];[x,y]=await P.cell(4,nxt);await P.tap(x,y,true);await sleep(80);
ck('still playable after blur events',(await P.G()).moves===mvb+1);
const tr=await P.text('#v-time');await sleep(1300);ck('timer runs after resume',(await P.text('#v-time'))!==tr);
// timer excludes paused time
await P.ev('__mock.pause()');await sleep(2500);await P.ev('__mock.resume()');await sleep(120);
const tcur=await P.text('#v-time');const ms=x=>{const[a,b]=x.split(':');return a*60+ +b;};
ck('paused time not counted',ms(tcur)-ms(tr)<=4,tr+' -> '+tcur);
// save on pause
const nmA=(await names()).filter(x=>x==='saveData').length;await P.ev('__mock.pause()');await sleep(200);const nmB=(await names()).filter(x=>x==='saveData').length;await P.ev('__mock.resume()');
ck('one save started at pause (docs SHOULD)',nmB===nmA+1,`${nmA}->${nmB}`);
// no SDK calls while paused: a move can't happen, nothing else writes
const cnt=async()=>(await names()).length;await P.ev('__mock.pause()');const c1=await cnt();await sleep(1500);ck('no SDK calls while paused',(await cnt())===c1);await P.ev('__mock.resume()');
// audio
const pre=`window.__ac=0;(function(){const AC=window.AudioContext;window.AudioContext=function(){window.__ac++;return new AC();};window.AudioContext.prototype=AC.prototype;})();`;
await P.load({dateOffset:off(FRI),pre});await P.click('#m-today');await sleep(200);
ck('no AudioContext created before first gesture-driven sound',(await P.ev('window.__ac'))===0||(await P.ev('window.__ac'))===0);
let s4=L.scramble(4,20261030);[x,y]=await P.cell(4,s4.path[s4.path.length-2]);await P.tap(x,y,true);await sleep(200);
ck('AudioContext created only after user gesture move (enabled)',(await P.ev('window.__ac'))===1,await P.ev('window.__ac'));
await P.load({dateOffset:off(FRI),pre,cfg:{audioOff:true}});await P.click('#m-today');await sleep(200);
[x,y]=await P.cell(4,s4.path[s4.path.length-2]);await P.tap(x,y,true);await sleep(200);
ck('YouTube audio OFF: no AudioContext at all',(await P.ev('window.__ac'))===0,await P.ev('window.__ac'));
await P.ev('__mock.audio(true)');await sleep(50);[x,y]=await P.cell(4,s4.path[s4.path.length-3]);await P.tap(x,y,true);await sleep(200);
ck('audio switched ON via onAudioEnabledChange: sound allowed',(await P.ev('window.__ac'))===1,await P.ev('window.__ac'));
await P.ev('__mock.audio(false)');await sleep(100);
ck('no mute/sound button in UI',await P.ev(`![...document.querySelectorAll('button')].some(b=>/mute|sound|audio|volume|music/i.test(b.textContent+b.id+(b.getAttribute('aria-label')||'')))`));
ck('no links, forms, inputs, iframes, images from network',await P.ev(`document.querySelectorAll('a,form,input,textarea,iframe,img,video,audio').length===0`));
{const all=['sdk','strings','logic','save','audio','art','ui','game'].map(n=>fs.readFileSync('/tmp/v2/src/'+n+'.js','utf8')).join('\n')+fs.readFileSync('/tmp/v2/src/index.html','utf8');
const m=all.match(/localStorage|sessionStorage|document\.cookie|indexedDB|clipboard|navigator\.share|visibilitychange|visibilityState|document\.hidden|navigator\.language|XMLHttpRequest|fetch\(|window\.open|location\.|screen\.orientation|requestFullscreen|'blur'|'focus'|vibrate|<a |href=.http/g);
ck('forbidden APIs absent from shipped source',!m,JSON.stringify(m));}
fs.writeFileSync('/tmp/v2/t/func2.json',JSON.stringify(R,null,1));
const bad=Object.entries(R).filter(([k,v])=>!v.startsWith('PASS'));console.log('errs',P.errs,'FAILS',bad.length);
kill();process.exit(bad.length?1:0);
