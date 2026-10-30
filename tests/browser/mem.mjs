import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
function solve3(b){ // BFS from solved over 3x3, returns list of tile cells to tap
  const key=a=>a.join(''),goal=key(L.solvedBoard(3));const prev=new Map([[key(b),null]]);let q=[b.slice()];
  while(q.length){const nq=[];for(const s of q){const k=key(s);if(k===goal){const path=[];let c=k;while(prev.get(c)){const[pk,cell]=prev.get(c);path.push(cell);c=pk;}return path.reverse();}
    const g=s.indexOf(0);for(const nb of L.neighbors(3,g)){const t=s.slice();t[g]=t[nb];t[nb]=0;const kk=key(t);if(!prev.has(kk)){prev.set(kk,[k,nb]);nq.push(t);}}}q=nq;}}
await P.load({w:390,h:844});
const heap=async()=>{await P.send('HeapProfiler.enable');await P.send('HeapProfiler.collectGarbage');await P.send('HeapProfiler.collectGarbage');return +(await P.ev('performance.memory.usedJSHeapSize'));};
const nodes=async()=>+(await P.ev('document.getElementsByTagName("*").length'));
const samples=[];let n0=await nodes();
for(let i=1;i<=30;i++){
  if(i===1){await P.click('.size-btn[data-size="3"]');}else{await sleep(500);await P.click('#modal-box .primary');}
  await sleep(200);
  const g=await P.G();const path=solve3(g.board);
  for(const cell of path){const[x,y]=await P.cell(3,cell);await P.tap(x,y,i%2===0);await sleep(4);}
  await sleep(500);
  const gg=await P.G();if(!gg.won){console.log('not won at',i);break;}
  if(i%10===0||i===2)samples.push([i,await heap(),await nodes()]);
}
console.log(JSON.stringify(samples));
const first=samples.find(s=>s[0]===10)?.[1],last=samples[samples.length-1][1];
ck('JS heap after 30 puzzles within +1.5MB of after 10, far below 512MB',last-first<1.5e6&&last<64e6,JSON.stringify(samples));
ck('DOM node count constant across puzzles',samples.every(s=>s[2]===samples[0][2]),JSON.stringify(samples));
ck('stats counted 30 games',(await P.G()).state.stats.played===30,String((await P.G()).state.stats.played));
ck('no errors',P.errs.length===0,P.errs.join('|'));
fs.writeFileSync('/tmp/v2/t/mem.json',JSON.stringify(R,null,1));kill();process.exit(0);
