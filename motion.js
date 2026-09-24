/* Motion is optional: data rendering and all controls work without GSAP. */
(function () {
  'use strict';
  const gsap=window.gsap;
  const scene=document.querySelector('.orbit-scene');
  const toggle=document.getElementById('motion-toggle');
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=preference.matches, visible=true, first=true, phase=0, lastRate=null, rateTween=null;
  const satellites=[...document.querySelectorAll('.satellite')];
  function position() {
    const small=scene.clientWidth<350;
    const rx=Math.min(scene.clientWidth/2-24,156), ry=small?111:127;
    satellites.forEach((node,i)=>{
      const angle=phase+i*Math.PI*2/3;
      const x=Math.cos(angle)*rx, y=Math.sin(angle)*ry;
      node.style.transform=`translate(${x-18.5}px,${y-18.5}px)`;
    });
  }
  function sync() {
    document.body.classList.toggle('motion-paused',paused);
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.title=paused?'播放动效':'暂停动效';toggle.setAttribute('aria-label',toggle.title);
    toggle.querySelector('img').src=paused?'assets/play.svg':'assets/pause.svg';
    if(paused&&gsap)gsap.globalTimeline.getChildren().forEach(tween=>tween.progress(1));
  }
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  preference.addEventListener('change',()=>{paused=preference.matches;sync();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});
  observer.observe(scene);
  const size=new ResizeObserver(position);size.observe(scene);
  if(gsap)gsap.ticker.add((time,delta)=>{
    if(paused||document.hidden||!visible)return;
    phase+=Math.min(delta,50)/1000*.17;position();
  });
  window.addEventListener('observatory:render',event=>{
    const rate=event.detail.rate;
    rateTween?.kill();
    if(gsap&&!paused){
      if(first){
        gsap.from('.hero-copy > *',{y:12,opacity:0,duration:.7,stagger:.07,clearProps:'all'});
        gsap.from('.orbit-scene',{scale:.92,opacity:0,rotation:-8,duration:1.1,ease:'power3.out',clearProps:'all'});
        gsap.from('.hour-column',{scaleY:.35,opacity:0,stagger:.018,duration:.65,ease:'power2.out',clearProps:'all'});
      }
      if(rate!==null&&rate!==lastRate){
        const label=document.getElementById('overall-rate');
        const number={value:lastRate===null?Math.max(0,rate-.08):lastRate};
        rateTween?.kill();
        rateTween=gsap.to(number,{value:rate,duration:1.2,ease:'power2.out',onUpdate:()=>{label.textContent=`${(number.value*100).toFixed(number.value===1?0:1)}%`;}});
      }
    }
    lastRate=rate;first=false;
  });
  position();sync();
})();
