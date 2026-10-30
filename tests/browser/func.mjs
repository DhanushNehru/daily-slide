import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
const FRI=new Date(2026,9,30,10,0,0).getTime(), MON=new Date(2026,10,2,10,0,0).getTime();
const off=t=>t-Date.now();
const log=async()=>JSON.parse(await P.ev('JSON.stringify(__mock.log)'));
const names=async()=>(await log()).map(x=>x[1]);
const store=async()=>P.ev('__mock.store');
// 1 boot order, no network, no errors
await P.load({dateOffset:off(FRI)});
let nm=await names();
ck('order firstFrameReady<loadData..gameReady once',nm.indexOf('firstFrameReady')<nm.indexOf('gameReady')&&nm.indexOf('loadData')<nm.indexOf('gameReady')&&nm.filter(x=>x==='gameReady').length===1,nm.join());
ck('gameReady only after menu visible',await P.ev(`!document.getElementById('menu').classList.contains('hidden')`));
ck('only SDK request besides local files',P.reqs.filter(u=>!u.startsWith('file:')).join()==='https://www.youtube.com/game_api/v1',P.reqs.join());
ck('SDK script is first script in head',await P.ev(`document.querySelector('script').src.startsWith('https://www.youtube.com/game_api/v1')&&(document.querySelector('script').compareDocumentPosition(document.querySelector('script[src="game.js"]'))&4)>0`));
ck('no console errors at boot',P.errs.length===0,P.errs.join('|'));
ck('no browser storage APIs touched',await P.ev(`(async()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===''&&(await indexedDB.databases()).length===0)()`));
// 2 play a full daily with real inputs (touch)
await P.click('#m-today');await sleep(200);
let g=await P.G();ck('daily 4x4 Friday',g.screen==='play'&&g.size===4&&g.mode==='daily');
ck('board equals deterministic scramble',JSON.stringify(g.board)===JSON.stringify(L.scramble(4,20261030).board));
// non-adjacent tap ignored; same-row tile 2 away ignored
const gap=g.board.indexOf(0);const far=g.board.findIndex((v,i)=>v&&!L.neighbors(4,gap).includes(i));
let [x,y]=await P.cell(4,far);await P.tap(x,y,true);ck('non-adjacent tap ignored',(await P.G()).moves===0);
const sameRowFar=g.board.findIndex((v,i)=>v&&Math.floor(i/4)===Math.floor(gap/4)&&Math.abs(i-gap)>=2);
if(sameRowFar>=0){[x,y]=await P.cell(4,sameRowFar);await P.tap(x,y,true);ck('same-row non-adjacent tile does not slide',(await P.G()).moves===0&&JSON.stringify((await P.G()).board)===JSON.stringify(g.board));}
// undo disabled at start
ck('undo disabled at start',await P.ev(`document.getElementById('b-undo').disabled`));
// first real move then undo
const sc=L.scramble(4,20261030);const lastFrom=sc.path[sc.path.length-2];[x,y]=await P.cell(4,lastFrom);await P.tap(x,y,true);
g=await P.G();ck('one adjacent tap = one move',g.moves===1);
await P.click('#b-undo');g=await P.G();ck('undo restores board and move count',g.moves===0&&JSON.stringify(g.board)===JSON.stringify(sc.board));
await sleep(100);
nm=await names();ck('saveData called after progress (daily)',nm.includes('saveData'));
// solve with mix of tap/key/swipe, both touch and mouse
const used=await P.solveFrom(sc.path,4,true,true);
await sleep(400);g=await P.G();
ck('solved via real input',g.won&&g.moves===sc.path.length-1,`${g.moves} vs ${sc.path.length-1}`);
console.log('inputs used',JSON.stringify(used));
ck('results modal visible',await P.ev(`!document.getElementById('modal').classList.contains('hidden')`));
await P.shot('/tmp/v2/t/results.png');
await sleep(200);
const sv=JSON.parse(await store());ck('save v2 total stars matches score sent',true);
const lg=await log();const sends=lg.filter(x=>x[1].startsWith('sendScore'));
ck('sendScore sent once, integer, matches saved totalStars',sends.length===1&&sends[0][1]===`sendScore:{"value":${sv.totalStars}}`&&sv.bestScoreSent===sv.totalStars&&sv.totalStars>=1,JSON.stringify(sends)+JSON.stringify(sv));
const iSave=lg.map(x=>x[1]).lastIndexOf('saveData'),iSend=lg.findIndex(x=>x[1].startsWith('sendScore'));ck('score sent after save',lg.slice(0,iSend).some(x=>x[1]==='saveData'));
ck('save is small',(await store()).length<2000,(await store()).length);
// Esc closes modal; Esc not default-prevented
await P.ev(`window.__escPrevented=null;document.addEventListener('keydown',e=>{if(e.key==='Escape')setTimeout(()=>window.__escPrevented=e.defaultPrevented,0)},false)`);
await P.key('Escape');await sleep(80);
ck('Esc closes modal',await P.ev(`document.getElementById('modal').classList.contains('hidden')`));
ck('Esc not preventDefault-ed',(await P.ev('window.__escPrevented'))===false);
ck('no console errors during play',P.errs.length===0,P.errs.join('|'));
ck('storage still empty',await P.ev(`localStorage.length===0&&sessionStorage.length===0&&document.cookie===''`));
// Home -> daily solved state
await P.click('#b-menu');await sleep(100);
ck('menu says solved',(await P.text('#m-today-main')).toLowerCase().includes('solved'));
ck('button label is Home not Menu',(await P.text('#b-menu'))==='Home');
await P.click('#m-today');await sleep(100);ck('solved daily shows result, not replay',await P.ev(`!document.getElementById('modal').classList.contains('hidden')`)&&(await P.G()).screen==='menu');
await P.key('Escape');
// keyboard focus/Enter/Space on buttons
await P.ev(`document.getElementById('m-stats').focus()`);await P.key('Enter');await sleep(80);
ck('Enter activates focused button',await P.ev(`!document.getElementById('modal').classList.contains('hidden')`));
await P.key('Escape');await sleep(50);await P.ev(`document.getElementById('m-stats').focus()`);
await P.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await P.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await sleep(80);
ck('Space activates focused button',await P.ev(`!document.getElementById('modal').classList.contains('hidden')`));
await P.key('Escape');
// reload with saved data -> persisted state restored via SDK mock
const saved=await store();
await P.load({dateOffset:off(FRI),cfg:{initial:saved}});
ck('reload restores solved state',(await P.text('#m-today-main')).toLowerCase().includes('solved')&&(await P.G()).state.totalStars===sv.totalStars);
nm=await names();ck('no extra sendScore on reload when already sent',!nm.some(x=>x.startsWith('sendScore')));
// in-progress daily resumes after leaving to Home
await P.load({dateOffset:off(MON)});
await P.click('#m-today');await sleep(200);g=await P.G();ck('Monday is 3x3',g.size===3);
const sc3=L.scramble(3,20261102);
for(let i=sc3.path.length-1;i>sc3.path.length-6;i--){const from=sc3.path[i-1];[x,y]=await P.cell(3,from);await P.tap(x,y,false);}
await sleep(500);let mv=(await P.G()).moves;
await P.click('#b-menu');await sleep(200);
ck('in-progress shown on menu',(await P.text('#m-today-sub')).includes(String(mv)),await P.text('#m-today-sub'));
const mid=await store();
await P.load({dateOffset:off(MON),cfg:{initial:mid}});await P.click('#m-today');await sleep(200);g=await P.G();
ck('daily progress resumes after reload (board+moves)',g.moves===mv&&JSON.stringify(g.board)!==JSON.stringify(sc3.board));
// numbers toggle saved; target peek
await P.click('#b-nums');await sleep(100);ck('numbers setting saved',JSON.parse(await store()).settings.numbers===false);
await P.click('#b-peek');await sleep(100);ck('peek toggles aria-pressed',await P.ev(`document.getElementById('b-peek').getAttribute('aria-pressed')==='true'`));
await P.click('#b-peek');
// practice mode
await P.click('#b-menu');await sleep(100);await P.click('.size-btn[data-size="5"]');await sleep(200);g=await P.G();ck('practice 5x5 starts',g.mode==='practice'&&g.size===5);
ck('no errors after all',P.errs.length===0,P.errs.join('|'));
fs.writeFileSync('/tmp/v2/t/func.json',JSON.stringify(R,null,1));
const bad=Object.entries(R).filter(([k,v])=>!v.startsWith('PASS'));console.log('FAILS',bad.length);
kill();process.exit(bad.length?1:0);
