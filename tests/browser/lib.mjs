import fs from 'fs';import {spawn} from 'child_process';import {createRequire} from 'module';
const require=createRequire(import.meta.url);
export const L=require('/tmp/v2/src/logic.js');
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chrome=null;
export async function launch(port=9335){
  if(!chrome){chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir=/tmp/v2/prof'+port,'--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info','about:blank'],{stdio:'ignore'});await sleep(1500);}
  return port;
}
export function kill(){try{chrome&&chrome.kill();}catch(e){}}
export async function open(port=9335){
  const r=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(r.webSocketDebuggerUrl);await new Promise(x=>ws.onopen=x);
  let id=0;const pend={};const P={errs:[],reqs:[],cons:[],log:[]};
  const mockSrc=fs.readFileSync('/tmp/v2/mock.js','utf8');
  ws.onmessage=async e=>{const m=JSON.parse(e.data);
    if(m.id&&pend[m.id]){pend[m.id](m.result||m.error);delete pend[m.id];return;}
    if(m.method==='Network.requestWillBeSent')P.reqs.push(m.params.request.url);
    else if(m.method==='Runtime.exceptionThrown')P.errs.push('EXC '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
    else if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))P.errs.push('CONSOLE.'+m.params.type+' '+m.params.args.map(a=>a.value).join(' '));
    else if(m.method==='Log.entryAdded'&&['error'].includes(m.params.entry.level))P.errs.push('LOG '+m.params.entry.text+' '+(m.params.entry.url||''));
    else if(m.method==='Fetch.requestPaused'){
      const u=m.params.request.url;
      if(u.startsWith('https://www.youtube.com/game_api/v1')){
        if(P.sdk==='absent'){send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Failed'});}
        else if(P.sdk==='noenv'){send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from('window.ytgame={IN_PLAYABLES_ENV:false};').toString('base64')});}
        else send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(mockSrc).toString('base64')});
      } else send('Fetch.continueRequest',{requestId:m.params.requestId});
    }
  };
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
  P.send=send;
  P.ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('eval: '+JSON.stringify(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result?.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'https://www.youtube.com/*'}]});
  let shim=null;
  P.load=async(o={})=>{
    const {w=390,h=844,mob=true,cfg={},sdk='mock',dateOffset=0,dpr=2,url='file:///tmp/v2/src/index.html'}=o;
    P.sdk=sdk;P.errs.length=0;P.reqs.length=0;
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:dpr,mobile:mob});
    await send('Emulation.setTouchEmulationEnabled',{enabled:mob});
    await send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Calcutta'});
    if(shim)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:shim});
    const src=`window.__cfg=${JSON.stringify(cfg)};(function(){var RD=Date;window.__dateOff=${dateOffset};function FD(...a){if(!new.target)return new RD(RD.now()+window.__dateOff).toString();if(a.length===0)return new RD(RD.now()+window.__dateOff);return new RD(...a);}FD.prototype=RD.prototype;FD.now=function(){return RD.now()+window.__dateOff;};FD.UTC=RD.UTC;FD.parse=RD.parse;window.Date=FD;})();${o.pre||''}`;
    shim=(await send('Page.addScriptToEvaluateOnNewDocument',{source:src})).identifier;
    await send('Page.navigate',{url});
    await sleep(o.settle??900);
  };
  P.close=async()=>{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${r.id}`).catch(()=>{});};
  P.shot=async(f,clip)=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(f,Buffer.from(r.data,'base64'));};
  P.rect=async sel=>JSON.parse(await P.ev(`JSON.stringify((r=>({x:r.x,y:r.y,w:r.width,h:r.height}))(document.querySelector('${sel}').getBoundingClientRect()))`));
  P.tap=async(x,y,touch=true)=>{if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}await sleep(30);};
  P.click=async(sel,touch=true)=>{const r=await P.rect(sel);await P.tap(r.x+r.w/2,r.y+r.h/2,touch);};
  const KC={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Enter:13,' ':32,Tab:9};
  P.key=async k=>{const o={key:k,code:k===' '?'Space':k,windowsVirtualKeyCode:KC[k]};const txt=k.length===1?k:(k==='Enter'?'\r':undefined);await send('Input.dispatchKeyEvent',{type:txt?'keyDown':'rawKeyDown',...o,text:txt});await send('Input.dispatchKeyEvent',{type:'keyUp',...o});await sleep(25);};
  P.swipe=async(x,y,dx,dy,touch=false)=>{if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx/2,y:y+dy/2}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx/2,y:y+dy/2,button:'left'});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',clickCount:1});}await sleep(30);};
  P.G=async()=>JSON.parse(await P.ev(`JSON.stringify((g=>({screen:g.screen,mode:g.mode,size:g.size,board:g.board,moves:g.moves,paused:g.paused,won:g.won,saveEnabled:g.saveEnabled,state:g.state,todayKey:g.todayKey,undo:g.undo,par:g.par}))(__dailySlide.G))`));
  P.text=async sel=>P.ev(`document.querySelector('${sel}').textContent`);
  P.cell=async(n,idx)=>{const r=await P.rect('#board');const c=r.w/n;return [r.x+(idx%n+.5)*c,r.y+(Math.floor(idx/n)+.5)*c];};
  // real-input solver: plays the exact reverse of the scramble path with a mix of tap, keys, swipes
  P.solveFrom=async(path,n,touch,mix=true,used={tap:0,key:0,swipe:0})=>{
    for(let k=path.length-1;k>=1;k--){const from=path[k-1],to=path[k];const dr=Math.floor(to/n)-Math.floor(from/n),dc=to%n-from%n;const step=path.length-1-k;
      const mode=!mix?'tap':(step%9<4?'tap':step%9<7?'key':'swipe');
      if(mode==='key'){await P.key(dr>0?'ArrowDown':dr<0?'ArrowUp':dc>0?'ArrowRight':'ArrowLeft');used.key++;}
      else if(mode==='swipe'){const [x,y]=await P.cell(n,from);await P.swipe(x,y,dc*60,dr*60,touch);used.swipe++;}
      else{const [x,y]=await P.cell(n,from);await P.tap(x,y,touch);used.tap++;}
      await sleep(8);}
    return used;};
  return P;
}
export const R={};export const ck=(n,c,info)=>{R[n]=c?'PASS':'FAIL '+(info??'');console.log(c?'PASS':'FAIL',n,c?'':(info??''));};
