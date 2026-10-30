/* Test-only mock of the Playables SDK. Records calls in window.__log. */
(function(){
  var log=[],cfg=window.__cfg||{},store=cfg.initial===undefined?null:cfg.initial,pcb=[],rcb=[],acb=[],audio=!cfg.audioOff;
  var t0=performance.now();function L(x){log.push([Math.round(performance.now()-t0),x]);}
  var delay=cfg.loadDelay||0;
  window.ytgame={IN_PLAYABLES_ENV:true,SDK_VERSION:'mock',
   game:{firstFrameReady:function(){L('firstFrameReady');},gameReady:function(){L('gameReady');},
    loadData:function(){L('loadData');return new Promise(function(res,rej){setTimeout(function(){cfg.loadFail?rej(new Error('x')):res(store===null?'':store);},delay);});},
    saveData:function(s){L('saveData');return new Promise(function(res,rej){setTimeout(function(){if(cfg.saveFail){rej(new Error('x'));}else{store=s;res();}},cfg.saveDelay||0);});}},
   system:{getLanguage:function(){L('getLanguage');return Promise.resolve(cfg.lang||'en-US');},isAudioEnabled:function(){return audio;},
    onAudioEnabledChange:function(cb){acb.push(cb);},onPause:function(cb){pcb.push(cb);},onResume:function(cb){rcb.push(cb);}},
   health:{logError:function(){L('logError');},logWarning:function(){L('logWarning');}},
   engagement:{sendScore:function(o){L('sendScore:'+JSON.stringify(o));return new Promise(function(res,rej){setTimeout(function(){if(cfg.scoreFail){rej(new Error('x'));}else{res();}},cfg.scoreDelay||0);});},openYTContent:function(){}}};
  window.__mock={log:log,get store(){return store;},set store(v){store=v;},pause:function(){pcb.forEach(function(f){f();});},resume:function(){rcb.forEach(function(f){f();});},audio:function(on){audio=on;acb.forEach(function(f){f(on);});}};
})();
