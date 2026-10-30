import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
const MON=new Date(2026,10,2,10,0,0).getTime();const off=t=>t-Date.now();const o={dateOffset:off(MON)};
const log=async()=>JSON.parse(await P.ev('JSON.stringify(__mock.log)'));const names=async()=>(await log()).map(x=>x[1]);
const sc=L.scramble(3,20261102);
const solve=async(touch=true)=>{await P.click('#m-today');await sleep(150);await P.solveFrom(sc.path,3,touch,true);await sleep(400);};
// a. future version
const future=JSON.stringify({v:9,stats:{played:7,streak:4,bestStreak:5,lastDaily:20261101,totalMoves:300,dailyDone:6},totalStars:15,bestScoreSent:15,newThing:{a:1}});
await P.load({...o,cfg:{initial:future}});
ck('future save: note shown',(await P.text('#m-note')).includes('newer version'));
ck('future save: stats readable',(await P.G()).state.stats.played===7);
await solve();let nm=await names();
ck('future save: never saved over, no score sent',!nm.includes('saveData')&&!nm.some(x=>x.startsWith('sendScore')),nm.join());
ck('future save: stored value untouched',(await P.ev('__mock.store'))===future);
ck('future save: game still playable/won',(await P.G()).won);
// b. corrupt
await P.load({...o,cfg:{initial:'{{{not json'}});
ck('corrupt save: reset note, menu works',(await P.text('#m-note')).includes('reset')&&(await P.G()).screen==='menu');
await solve();nm=await names();
ck('corrupt save: replaced by valid v2 after play',JSON.parse(await P.ev('__mock.store')).v===2&&nm.includes('saveData'));
ck('corrupt: no errors',P.errs.length===0,P.errs.join('|'));
// c. load fails
await P.load({...o,cfg:{loadFail:true}});
nm=await names();ck('load rejects: menu + gameReady still happen',nm.includes('gameReady')&&(await P.G()).screen==='menu');
ck('load rejects: note shown',(await P.text('#m-note')).includes('could not be loaded'));
await solve();nm=await names();ck('load rejects: never saves / sends score',!nm.includes('saveData')&&!nm.some(x=>x.startsWith('sendScore')));
ck('load rejects: logWarning reported to SDK',nm.includes('logWarning'));
// d. load timeout, late data ignored
await P.load({...o,cfg:{loadDelay:6500,initial:future},settle:4600});
ck('load hangs: menu after ~4s timeout, interactive',(await P.G()).screen==='menu'&&!(await P.G()).saveEnabled);
const tgr=JSON.parse(await P.ev('JSON.stringify(__mock.log)')).find(x=>x[1]==='gameReady');ck('gameReady within 5s even if load hangs',tgr&&tgr[0]<5000,JSON.stringify(tgr));
await sleep(2500);ck('late load result ignored (no saves)',!(await names()).includes('saveData'));
// e. pause during boot
await P.load({...o,cfg:{loadDelay:900},settle:0});await sleep(450);await P.ev('__mock.pause()');await sleep(1500);
nm=await names();ck('paused during loading: no gameReady, menu not shown',!nm.includes('gameReady')&&await P.ev(`document.getElementById('menu').classList.contains('hidden')`),nm.join());
await P.ev('__mock.resume()');await sleep(400);nm=await names();ck('after resume: menu + gameReady once',nm.filter(x=>x==='gameReady').length===1&&(await P.G()).screen==='menu',nm.join());
// f. score fails then retried next launch
await P.load({...o,cfg:{scoreFail:true}});await solve();
let st=JSON.parse(await P.ev('__mock.store'));nm=await names();
ck('sendScore failure: bestScoreSent not advanced (matches what host got)',st.totalStars>=1&&st.bestScoreSent===0&&nm.some(x=>x.startsWith('sendScore'))&&nm.includes('logWarning'),JSON.stringify(st));
await P.load({...o,cfg:{initial:JSON.stringify(st)}});await sleep(300);nm=await names();
ck('retried at next launch with same value',nm.includes(`sendScore:{"value":${st.totalStars}}`),nm.join());
st=JSON.parse(await P.ev('__mock.store'));ck('after success bestScoreSent==totalStars',st.bestScoreSent===st.totalStars);
// g. pause while save/score in flight
await P.load({...o,cfg:{saveDelay:700,scoreDelay:700}});await P.click('#m-today');await sleep(150);
const p=sc.path;for(let k=p.length-1;k>=2;k--){const[x,y]=await P.cell(3,p[k-1]);await P.tap(x,y,true);}
// last move triggers win -> save in flight
await sleep(900);// let any progress saves settle
const [lx,ly]=await P.cell(3,p[0]);await P.tap(lx,ly,true);await sleep(150);
ck('won',(await P.G()).won);
await P.ev('__mock.pause()');const c0=(await names()).length;await sleep(1800);
nm=await names();ck('paused with save in flight: no sendScore/saveData issued while paused',!nm.slice(c0).some(x=>x==='saveData'||x.startsWith('sendScore')),nm.slice(c0).join());
await P.ev('__mock.resume()');await sleep(2200);nm=await names();
st=JSON.parse(await P.ev('__mock.store'));
ck('after resume: score sent once and matches saved',nm.filter(x=>x.startsWith('sendScore')).length===1&&st.bestScoreSent===st.totalStars&&st.totalStars>=1,JSON.stringify([nm.filter(x=>x.startsWith('sendScore')),st.totalStars,st.bestScoreSent]));
// h. save failure
await P.load({...o,cfg:{saveFail:true}});await solve();nm=await names();
ck('saveData rejects: game ok, no score sent, warning logged',(await P.G()).won&&!nm.some(x=>x.startsWith('sendScore'))&&nm.includes('logWarning')&&P.errs.length===0,P.errs.join('|'));
// i. language
await P.load({...o,cfg:{lang:'fr-FR'}});ck('unsupported language falls back to English; html lang=en',(await P.text('#m-stats'))==='Stats'&&(await P.ev('document.documentElement.lang'))==='en');
// j. no SDK at all / IN_PLAYABLES_ENV false
for(const sdk of['absent','noenv']){
 await P.load({...o,sdk});await P.click('#m-today');await sleep(150);await P.solveFrom(sc.path,3,true,true);await sleep(400);
 ck('fallback ('+sdk+'): works in normal browser, win reached',(await P.G()).won);
 ck('fallback ('+sdk+'): storage empty',await P.ev(`localStorage.length===0&&sessionStorage.length===0&&document.cookie===''`));
 const errs=P.errs.filter(e=>!/game_api|ERR_|Failed to load resource/.test(e));ck('fallback ('+sdk+'): no script errors',errs.length===0,errs.join('|'));
  await P.key('Escape');await P.click('#b-menu');await sleep(100);
 ck('fallback ('+sdk+'): in-memory state survives within session',(await P.text('#m-today-main')).toLowerCase().includes('solved'));
}
fs.writeFileSync('/tmp/v2/t/func3.json',JSON.stringify(R,null,1));
const bad=Object.entries(R).filter(([k,v])=>!v.startsWith('PASS'));console.log('FAILS',bad.length);kill();process.exit(bad.length?1:0);
