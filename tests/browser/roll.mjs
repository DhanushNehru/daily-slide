import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
// Mon 2026-11-02 23:59:40 IST: 3x3; roll past midnight while playing
const t=new Date(2026,10,2,23,59,40).getTime();const off=x=>x-Date.now();
await P.load({dateOffset:off(t)});
await P.click('#m-today');await sleep(200);
const sc=L.scramble(3,20261102);
const p=sc.path;let used={tap:0,key:0,swipe:0};
// play half
const half=Math.floor(p.length/2);
for(let k=p.length-1;k>p.length-1-half;k--){const[x,y]=await P.cell(3,p[k-1]);await P.tap(x,y,true);}
// cross midnight: shift clock +30s
await P.ev('window.__dateOff+=30000');await sleep(1200);
let g=await P.G();ck('rollover mid-puzzle: puzzle continues (same board, still playing)',g.screen==='play'&&g.mode==='daily'&&!g.won&&g.moves===half);
ck('rollover: puzzle key unchanged',await P.ev(`__dailySlide.G.puzzleKey===20261102`));
for(let k=p.length-1-half;k>=1;k--){const[x,y]=await P.cell(3,p[k-1]);await P.tap(x,y,true);}
await sleep(500);g=await P.G();ck('finished yesterday’s puzzle after midnight',g.won);
const labels=await P.ev(`[...document.querySelectorAll('#modal-box button')].map(b=>b.textContent).join('|')`);
ck('results offer new daily ("Play today\'s puzzle")',labels.includes("Play today's puzzle"),labels);
const st1=JSON.parse(await P.ev('__mock.store'));
ck('credited to the puzzle\'s own date 20261102',st1.stats.lastDaily===20261102&&st1.daily.key===20261102&&st1.daily.solved,JSON.stringify(st1.stats));
await P.click('#modal-box button.primary');await sleep(250);g=await P.G();
ck('new daily starts: Tuesday 3x3 key 20261103',g.mode==='daily'&&g.size===3&&await P.ev(`__dailySlide.G.puzzleKey===20261103`)&&JSON.stringify(g.board)===JSON.stringify(L.scramble(3,20261103).board));
// solve it; streak should be 2
const sc2=L.scramble(3,20261103);await P.solveFrom(sc2.path,3,true,false);await sleep(500);
const st2=JSON.parse(await P.ev('__mock.store'));ck('streak continues across midnight (2)',st2.stats.streak===2&&st2.stats.dailyDone===2,JSON.stringify(st2.stats));
ck('totalStars=sum of both dailies and score sent matches',st2.totalStars>=2&&st2.bestScoreSent===st2.totalStars);
// menu rollover while idle
await P.key('Escape');await P.click('#b-menu');await sleep(200);
await P.ev('window.__dateOff+=86400000');await sleep(1500);
ck('menu refreshes at midnight: new puzzle available',!(await P.text('#m-today-main')).toLowerCase().includes('solved'));
// rollover while paused applies on resume
await P.ev('__mock.pause()');await P.ev('window.__dateOff+=86400000');await sleep(300);await P.ev('__mock.resume()');await sleep(300);
ck('rollover during pause handled on resume (menu shows new day, no errors)',P.errs.length===0&&(await P.G()).todayKey===20261105,String((await P.G()).todayKey)+P.errs.join('|'));
fs.writeFileSync('/tmp/v2/t/roll.json',JSON.stringify(R,null,1));
const bad=Object.entries(R).filter(([k,v])=>!v.startsWith('PASS'));console.log('FAILS',bad.length);kill();process.exit(0);
