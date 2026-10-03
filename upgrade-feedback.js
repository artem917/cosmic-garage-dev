// Explicit info and purchase confirmation are independent interaction channels.
export function tooltipPosition(anchor,shell,box,viewport){
 const margin=8,topEdge=viewport.top??0,leftEdge=viewport.left??0;
 const width=Math.min(shell.width-28,viewport.width-margin*2);
 const left=Math.max(leftEdge+margin,Math.min(shell.left+14,leftEdge+viewport.width-width-margin));
 const top=Math.max(topEdge+margin,Math.min(anchor.top-box.height-8,topEdge+viewport.height-box.height-margin));
 return {left,top,width};
}
export function bindUpgradeFeedback({list,box,title,text,close,pop,configs,isGarage,position,document:doc=globalThis.document,schedule=setTimeout,cancel=clearTimeout}){
 let current=null,pinned=null,dismissed=null,timer=null;
 function hide(){current=null;pinned=null;box.hidden=true;list.querySelectorAll('[data-info]').forEach(b=>b.setAttribute('aria-expanded','false'));}
 function show(key,pin=false){
  if(!isGarage()||!configs[key]||(!pin&&(pinned||dismissed===key)))return;
  current=key;if(pin)pinned=key;title.textContent=configs[key].name;text.textContent=configs[key].description;
  close.hidden=false;box.hidden=false;
  list.querySelectorAll('[data-info]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.info===key)));
  position(key);
 }
 function dismiss(){const key=current;hide();dismissed=key;return key;}
 list.addEventListener('click',e=>{const b=e.target.closest('[data-info]');if(!b)return;if(pinned===b.dataset.info)dismiss();else{dismissed=null;show(b.dataset.info,true);}});
 list.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const b=e.target.closest('[data-info]');if(b)show(b.dataset.info);});
 list.addEventListener('focusin',e=>{const b=e.target.closest('[data-info]');if(b)show(b.dataset.info);});
 list.addEventListener('pointerout',e=>{
  const b=e.target.closest('[data-info]');if(!b||b.contains(e.relatedTarget)||box.contains(e.relatedTarget))return;
  if(!pinned&&doc.activeElement!==b)hide();
 });
 list.addEventListener('focusout',e=>{
  const b=e.target.closest('[data-info]');if(!b||b.contains(e.relatedTarget)||box.contains(e.relatedTarget))return;
  if(!pinned)hide();
 });
 box.addEventListener('pointerleave',()=>{if(!pinned&&!doc.activeElement?.closest('[data-info]'))hide();});
 close.addEventListener('click',()=>{const key=dismiss();list.querySelector(`[data-info="${key}"]`)?.focus({preventScroll:true});});
 doc.addEventListener('click',e=>{if(current&&!e.target.closest('[data-info]')&&!box.contains(e.target))dismiss();});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&current){const key=dismiss();list.querySelector(`[data-info="${key}"]`)?.focus({preventScroll:true});}});
 return {
  hide,reposition(){if(current)position(current);},
  purchase(key,level,effect){
   hide();dismissed=null;if(timer!==null)cancel(timer);
   pop.textContent=`${configs[key].name.toUpperCase()} · УР. ${level} — ${effect}`;
   pop.hidden=false;pop.style.animation='none';void pop.offsetWidth;pop.style.animation='';
   timer=schedule(()=>{pop.hidden=true;timer=null;},1000);
  },
 };
}
