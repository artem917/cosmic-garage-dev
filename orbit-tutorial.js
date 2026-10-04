// Presentation/input gate only. Never edits a board, energy, rewards or puzzle templates.
export const ORBIT_TUTORIAL_FLAGS=['firstPuzzleTutorialSeen','relayTutorialSeen','branchTutorialSeen','multiTargetTutorialSeen'];
export const TUTORIAL_COPY={
 rotate:'Нажми, чтобы повернуть провод по часовой.',
 connect:'Проведи питание от источника к отмеченному модулю.',
 energy:'Каждый поворот тратит энергию дрона.',
 retry:'Если ошибёшься — можно попробовать ещё раз.',
 relay:'Реле тоже должно получить питание.',
 branch:'Раздели питание на две линии.',
 multi:'Запитай обе системы.',
};
export function lessonPlan(state,board,jobId){
 const source=board.findIndex(t=>t.kind==='source'),targets=board.flatMap((t,i)=>t.kind==='target'?[i]:[]),lessons=[];
 if(jobId===1&&!state.firstPuzzleTutorialSeen){
  // One authored onboarding tile, not a full-board solution hint.
  lessons.push({id:'rotate',flag:'firstPuzzleTutorialSeen',tiles:[1],tap:1},
   {id:'connect',flag:'firstPuzzleTutorialSeen',tiles:[source,...targets]},
   {id:'energy',flag:'firstPuzzleTutorialSeen',meter:true,note:TUTORIAL_COPY.retry});
 }
 const relays=board.flatMap((t,i)=>t.kind==='relay'?[i]:[]);
 if(relays.length&&!state.relayTutorialSeen)lessons.push({id:'relay',flag:'relayTutorialSeen',tiles:relays});
 if(targets.length>1){
  const branch=board.findIndex(t=>t.kind==='connector'&&[7,11,13,14].includes(t.mask));
  if(branch>=0&&!state.branchTutorialSeen)lessons.push({id:'branch',flag:'branchTutorialSeen',tiles:[branch]});
  if(!state.multiTargetTutorialSeen)lessons.push({id:'multi',flag:'multiTargetTutorialSeen',tiles:targets});
 }
 return lessons;
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function tutorialLayout(viewport,spots,board,panelHeight){
 const v={left:viewport.left??0,top:viewport.top??0,width:viewport.width,height:viewport.height};
 v.right=v.left+v.width;v.bottom=v.top+v.height;
 const width=Math.min(320,v.width-16),left=clamp(board.left,v.left+8,v.right-width-8);
 const candidates=[board.top-panelHeight-12,v.top+8,Math.max(...spots.map(r=>r.bottom))+12,board.bottom+12,v.bottom-panelHeight-8];
 const panels=candidates.map(top=>{top=clamp(top,v.top+8,v.bottom-panelHeight-8);return {left,top,width,height:panelHeight,right:left+width,bottom:top+panelHeight};});
 const panel=panels.find(p=>spots.every(s=>!overlaps(p,s)))??panels[0];
 const holes=spots.map(r=>({left:clamp(r.left-4,v.left,v.right),top:clamp(r.top-4,v.top,v.bottom),right:clamp(r.right+4,v.left,v.right),bottom:clamp(r.bottom+4,v.top,v.bottom)}));
 const tile=spots[0],hand={left:tile.right+5,top:tile.bottom-8,width:48,height:60};
 // The glove sits beside, never on top of, the actual first-tap tile.
 if(hand.left+48>v.right-4)hand.left=tile.left-53;
 hand.top=clamp(hand.top,v.top+4,v.bottom-64);
 return {viewport:v,panel,holes,hand};
}

export function createOrbitTutorial({getState,save,document:doc=globalThis.document,onPause=()=>{},onResume=()=>{}}){
 const ids=['orbitPuzzleTutorial','orbitTutorialShade','orbitTutorialSpots','orbitTutorialHand','orbitTutorialPanel','orbitTutorialStep','orbitTutorialText','orbitTutorialNote','orbitTutorialNext','orbitTutorialSkip','orbitTutorialClose','circuitBoard','droneEnergyHud'];
 const el=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));
 let queue=[],current=null;
 const rect=node=>node.getBoundingClientRect();
 function position(){
  if(!current)return;
  const win=doc.defaultView,visual=win?.visualViewport;
  const viewport={left:visual?.offsetLeft??0,top:visual?.offsetTop??0,width:visual?.width??win?.innerWidth??320,height:visual?.height??win?.innerHeight??640};
  const nodes=current.meter?[el.droneEnergyHud]:current.tiles.map(i=>el.circuitBoard.children[i]);
  // Measure wrapped copy at its actual responsive width, including after resize.
  el.orbitTutorialPanel.style.width=Math.min(320,viewport.width-16)+'px';
  const layout=tutorialLayout(viewport,nodes.map(rect),rect(el.circuitBoard),rect(el.orbitTutorialPanel).height||140),v=layout.viewport;
  const box=r=>`M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`;
  el.orbitTutorialShade.setAttribute('d',box(v)+layout.holes.map(box).join(''));
  el.orbitTutorialSpots.innerHTML=layout.holes.map(r=>`<rect x="${r.left}" y="${r.top}" width="${r.right-r.left}" height="${r.bottom-r.top}" rx="6"/>`).join('');
  Object.assign(el.orbitTutorialPanel.style,{left:layout.panel.left+'px',top:layout.panel.top+'px',width:layout.panel.width+'px'});
  Object.assign(el.orbitTutorialHand.style,{left:layout.hand.left+'px',top:layout.hand.top+'px'});
 }
 function clear(){
  current=null;el.orbitPuzzleTutorial.hidden=true;el.orbitPuzzleTutorial.dataset.step='';onResume();
 }
 function showNext(){
  const next=queue.shift();if(!next){clear();el.circuitBoard.children[1]?.focus?.({preventScroll:true});return;}
  current=next;
  // Persist on presentation: reload during a lesson does not repeatedly interrupt.
  if(!getState()[current.flag]){getState()[current.flag]=true;save();}
  el.orbitPuzzleTutorial.dataset.step=current.id;el.orbitPuzzleTutorial.hidden=false;
  el.orbitTutorialStep.textContent=current.flag==='firstPuzzleTutorialSeen'?`БЫСТРЫЙ РЕМОНТ · ${['rotate','connect','energy'].indexOf(current.id)+1} / 3`:'НОВАЯ СИСТЕМА';
  el.orbitTutorialText.textContent=TUTORIAL_COPY[current.id];el.orbitTutorialNote.textContent=current.note??'';el.orbitTutorialNote.hidden=!current.note;
  el.orbitTutorialNext.hidden=current.tap!==undefined;el.orbitTutorialNext.textContent=current.id==='energy'?'НАЧАТЬ РЕМОНТ':'ПОНЯТНО';
  // SVG has no native HTMLElement.hidden property: change the actual attribute.
  el.orbitTutorialHand.toggleAttribute('hidden',current.tap===undefined);onPause(current.tap);position();
  (current.tap!==undefined?el.circuitBoard.children[current.tap]:el.orbitTutorialNext).focus({preventScroll:true});
 }
 function skip(){if(!current)return;queue=[];clear();el.circuitBoard.children[1]?.focus?.({preventScroll:true});}
 el.orbitTutorialNext.addEventListener('click',()=>{if(current&&current.tap===undefined)showNext();});
 el.orbitTutorialSkip.addEventListener('click',skip);el.orbitTutorialClose.addEventListener('click',skip);
 doc.addEventListener?.('keydown',event=>{
  if(!current)return;
  if(event.key==='Escape'){event.preventDefault();skip();return;}
  if(event.key!=='Tab')return;
  const nodes=[current.tap!==undefined?el.circuitBoard.children[current.tap]:el.orbitTutorialNext,el.orbitTutorialSkip,el.orbitTutorialClose];
  const index=nodes.indexOf(doc.activeElement),next=(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length;
  event.preventDefault();nodes[next].focus({preventScroll:true});
 });
 doc.defaultView?.addEventListener?.('resize',position);
 doc.defaultView?.addEventListener?.('scroll',position,{passive:true});
 doc.defaultView?.visualViewport?.addEventListener?.('resize',position);
 doc.defaultView?.visualViewport?.addEventListener?.('scroll',position);
 return {
  get active(){return !!current;},
  begin(board,jobId){queue=lessonPlan(getState(),board,jobId);showNext();},
  acceptTap(index,rotate){
   if(!current||current.tap===undefined||current.tap!==index)return false;
   const lesson=current;clear(); // Resume BEFORE the single ordinary energy-spending action.
   if(!rotate()){current=lesson;queue.unshift(lesson);showNext();return false;}
   showNext();return true;
  },
  cancel(){queue=[];clear();},
 };
}
