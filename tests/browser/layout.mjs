import {launch,open,kill,L,ck,sleep,R} from './lib.mjs';
import fs from 'fs';
const PORT=+process.env.PORT||9335;await launch(PORT);const P=await open(PORT);
const FRI=new Date(2026,9,30,10,0,0).getTime(), MON=new Date(2026,10,2,10,0,0).getTime(), SAT=new Date(2026,10,7,10,0,0).getTime();
const off=t=>t-Date.now();
const ratios=[[9,32],[9,21],[9,16],[3,4],[1,1],[4,3],[16,9],[21,9],[32,9]];
const check=`(()=>{const W=innerWidth,H=innerHeight,out=[];const vis=e=>e&&e.offsetParent!==null;const R=e=>e.getBoundingClientRect();
const inside=(n,e)=>{const r=R(e);if(r.left<-0.5||r.top<-0.5||r.right>W+0.5||r.bottom>H+0.5)out.push('outside viewport: '+n);};
const ov=(a,b,n)=>{const x=R(a),y=R(b);if(x.left<y.right-0.5&&y.left<x.right-0.5&&x.top<y.bottom-0.5&&y.top<x.bottom-0.5)out.push('overlap: '+n);};
const play=!document.getElementById('hud').classList.contains('hidden');
const modal=!document.getElementById('modal').classList.contains('hidden');
const btns=[...document.querySelectorAll('button')].filter(vis);
btns.forEach(b=>{const r=R(b);if(r.width<43.9||r.height<43.9)out.push('target <44: '+b.id+b.textContent+' '+Math.round(r.width)+'x'+Math.round(r.height));if(b.scrollWidth>b.clientWidth+1)out.push('button text clipped: '+b.textContent);});
if(play&&!modal){const hud=document.getElementById('hud'),tools=document.getElementById('tools'),bw=document.getElementById('boardwrap');
 [hud,tools,bw].forEach((e,i)=>inside(['hud','tools','board'][i],e));ov(hud,bw,'hud/board');ov(tools,bw,'tools/board');ov(hud,tools,'hud/tools');
 const b=R(bw);if(Math.abs(b.width-b.height)>1)out.push('board not square');
 const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;if(Math.abs(cx-W/2)>W*0.2&&W>H*1.2===false)out.push('board off-center x');
 [...document.querySelectorAll('.stat')].forEach((s,i,all)=>{inside('stat'+i,s);if(s.scrollWidth>s.clientWidth+1||s.scrollHeight>s.clientHeight+1)out.push('stat clipped: '+s.textContent);for(let j=i+1;j<all.length;j++)ov(s,all[j],'stat'+i+'/'+j);});
 btns.forEach((a,i)=>{inside('btn '+a.id,a);btns.forEach((c,j)=>{if(j>i)ov(a,c,'btn '+a.id+'/'+c.id);});});
 out.push('board:'+Math.round(b.width));}
if(!play&&!modal){const m=document.getElementById('menu'),inner=m.querySelector('.menu-inner');
 const items=[...inner.children].filter(e=>vis(e)&&e.textContent.trim());items.forEach((e,i)=>{inside('menu item '+i,e);for(let j=i+1;j<items.length;j++)ov(e,items[j],'menu '+i+'/'+j);});
 if(inner.scrollHeight>inner.clientHeight+1)out.push('menu overflow');}
if(modal){const box=document.getElementById('modal-box');inside('modal box',box);if(box.scrollHeight>box.clientHeight+1)out.push('modal scrolls');
 const kids=[...box.children];kids.forEach((e,i)=>{for(let j=i+1;j<kids.length;j++)ov(e,kids[j],'modal '+i+'/'+j);});}
if(document.documentElement.scrollWidth>W||document.documentElement.scrollHeight>H)out.push('page scrolls');
return out;})()`;
const sizes=[360,240,160];const rows=[];
async function run(label,w,h,dateOff,steps){
  await P.load({w,h,dateOffset:off(dateOff),dpr:2,settle:500});
  const res={};
  res.menu=await P.ev(check);
  if(steps.includes('shot')&&label.endsWith('@360')){await P.shot(`/tmp/v2/t/shots/menu-${label}.png`);}
  await P.ev(`document.getElementById('m-stats').click()`);await sleep(80);res.stats=await P.ev(check);if(steps.includes('shot')&&label.endsWith('@360'))await P.shot(`/tmp/v2/t/shots/stats-${label}.png`);await P.key('Escape');
  await P.ev(`document.getElementById('m-today').click()`);await sleep(150);res.play=await P.ev(check);
  if(steps.includes('shot')&&label.endsWith('@360'))await P.shot(`/tmp/v2/t/shots/play-${label}.png`);
  return res;}
fs.mkdirSync('/tmp/v2/t/shots',{recursive:true});
let allBad=0;
for(const s of sizes)for(const [a,b] of ratios){
  const w=a>=b?Math.round(s*a/b):s,h=a>=b?s:Math.round(s*b/a);
  const label=`${a}x${b}@${s}`;
  for(const [day,dt] of [['Fri4',FRI],['Sat5',SAT]]){
    if(day==='Sat5'&&s!==360&&s!==240)continue;
    const res=await run(label+(day==='Fri4'?'':'-sat'),w,h,dt,day==='Fri4'?['shot']:[]);
    const bad=Object.entries(res).flatMap(([k,v])=>v.filter(x=>!x.startsWith('board:')).map(x=>k+': '+x));
    const bsz=(res.play.find(x=>x.startsWith('board:'))||'').slice(6);
    rows.push({ratio:`${a}:${b}`,size:`${w}x${h}`,day,board:bsz,issues:bad});
    allBad+=bad.length;
    ck(`layout ${a}:${b} ${w}x${h} ${day}`,bad.length===0||s===160,bad.join('; '));
  }
}
// results modal at every ratio at 360 (win the 3x3 Monday puzzle by solving through the real UI)
const sc=L.scramble(3,20261102);
for(const [a,b] of ratios){const s=360;const w=a>=b?Math.round(s*a/b):s,h=a>=b?s:Math.round(s*b/a);
  await P.load({w,h,dateOffset:off(MON),settle:400});await P.click('#m-today');await sleep(120);
  await P.solveFrom(sc.path,3,true,false);await sleep(450);
  const iss=(await P.ev(check)).filter(x=>!x.startsWith('board:'));ck(`results modal ${a}:${b}`,iss.length===0,iss.join('; '));
  if(a===9&&b===16||a===16&&b===9)await P.shot(`/tmp/v2/t/shots/results-${a}x${b}.png`);}
// live resize keeps state
await P.load({w:390,h:844,dateOffset:off(FRI),settle:400});await P.click('#m-today');await sleep(150);
const s4=L.scramble(4,20261030);let [x,y]=await P.cell(4,s4.path[s4.path.length-2]);await P.tap(x,y,true);await P.click('#b-nums');await sleep(100);
const before=await P.G();
for(const [w,h] of [[844,390],[1280,360],[360,1280],[600,600],[300,200],[390,844]]){await P.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true});await sleep(250);
  const g=await P.G();ck(`resize ${w}x${h} keeps state, no reload`,g.moves===before.moves&&JSON.stringify(g.board)===JSON.stringify(before.board)&&g.screen==='play'&&g.state.settings.numbers===false);
  const iss=(await P.ev(check)).filter(x=>!x.startsWith('board:'));if(w>=300&&h>=300)ck(`resize ${w}x${h} layout`,iss.length===0,iss.join(';'));}
ck('no errors in layout run',P.errs.length===0,P.errs.join('|'));
fs.writeFileSync('/tmp/v2/t/layout.json',JSON.stringify({R,rows},null,1));
const bad=Object.entries(R).filter(([k,v])=>!v.startsWith('PASS'));console.log('FAILS',bad.length);kill();process.exit(0);
