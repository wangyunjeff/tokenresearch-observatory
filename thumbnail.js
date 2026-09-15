/* Runs inside sandboxed thumbnails only. */
window.OBS_THUMBNAIL_RUNTIME=function(){
  const native={raf:requestAnimationFrame.bind(window),caf:cancelAnimationFrame.bind(window),timer:setTimeout.bind(window),clear:clearTimeout.bind(window)};
  const jobs=new Map(),animations=new Set();
  let active=true,wanted=false,ready=false,seq=0;
  const style=document.createElement('style');
  style.textContent='html[data-observatory-paused] *,html[data-observatory-paused] *::before,html[data-observatory-paused] *::after{animation-play-state:paused!important;transition:none!important}';
  document.head.append(style);
  function schedule(id,job){
    if(!active)return;
    const run=time=>{
      job.handle=null;if(!active)return;if(!job.repeat)jobs.delete(id);
      try{if(typeof job.cb==='function')job.cb(...(job.raf?[time]:job.args));else (0,eval)(String(job.cb));}
      finally{if(job.repeat&&jobs.has(id))schedule(id,job);}
    };
    job.handle=job.raf?native.raf(run):native.timer(run,job.delay);
  }
  function add(cb,delay,args,raf,repeat){const id=++seq,job={cb,delay,args,raf,repeat,handle:null};jobs.set(id,job);schedule(id,job);return id;}
  function cancel(id){const job=jobs.get(id);if(!job)return;if(job.handle!==null)(job.raf?native.caf:native.clear)(job.handle);jobs.delete(id);}
  window.requestAnimationFrame=cb=>add(cb,0,[],true,false);window.cancelAnimationFrame=cancel;
  window.setTimeout=(cb,delay,...args)=>add(cb,delay,args,false,false);
  window.setInterval=(cb,delay,...args)=>add(cb,delay,args,false,true);
  window.clearTimeout=window.clearInterval=cancel;
  function play(value){
    if(active===value)return;active=value;
    document.documentElement.toggleAttribute('data-observatory-paused',!value);
    if(value){
      animations.forEach(a=>{try{a.play();}catch{}});animations.clear();
      document.querySelectorAll('svg').forEach(svg=>svg.unpauseAnimations?.());
      jobs.forEach((job,id)=>schedule(id,job));
    }else{
      document.getAnimations().forEach(a=>{if(a.playState==='running'){animations.add(a);a.pause();}});
      document.querySelectorAll('svg').forEach(svg=>svg.pauseAnimations?.());
      jobs.forEach(job=>{if(job.handle!==null)(job.raf?native.caf:native.clear)(job.handle);job.handle=null;});
    }
  }
  window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='observatory-thumbnail-play')return;wanted=e.data.play===true;if(ready)play(wanted);});
  // Permit initialization and first paint, then suspend animation drivers.
  window.addEventListener('load',()=>native.timer(()=>{ready=true;play(wanted);},120),{once:true});
};
