export const UPGRADE_ORDER = ["engine","fuel","hull","guidance","magnet"];
export const UPGRADES = {
 engine:{name:"Двигатель",baseCost:65,description:"Выше на том же топливе. После удара тяга восстанавливается быстрее."},
 fuel:{name:"Топливный бак",baseCost:60,description:"Больше топлива на старте — дольше летишь и выше поднимаешься."},
 hull:{name:"Защитный модуль",baseCost:300,description:"Ещё одна жизнь: 2 → 3 защитные секции. Любая опасность снимает ровно одну. Один модуль, без четвёртой секции. Стоит 300 лома: копить на защиту или улучшать другие детали?"},
 guidance:{name:"Наведение",baseCost:70,description:"Точнее рулишь: меньше сносит ветром, быстрее стабилизируется после удара."},
 magnet:{name:"Магнит",baseCost:50,description:"Собирает лом издалека — не нужно подлетать так близко к опасности."},
};
export const INITIAL_LEVELS=Object.freeze(Object.fromEntries(UPGRADE_ORDER.map(k=>[k,0])));
// Internal route coordinate is NOT metres; telemetry maps a compressed journey to km.
export const ROUTE_END=2000;
export const MILESTONES=[{altitude:0,km:0,name:"Тропосфера"},{altitude:200,km:12,name:"Стратосфера"},{altitude:650,km:50,name:"Мезосфера"},{altitude:1050,km:85,name:"Верхняя атмосфера"},{altitude:1250,km:100,name:"Орбитальный подъём"},{altitude:2000,km:200,name:"Орбита"}];
export function altitudeKm(a){
 a=clamp(a,0,ROUTE_END);
 const hi=MILESTONES.findIndex(m=>m.altitude>a);
 if(hi<0)return 200;
 const lo=MILESTONES[hi-1],next=MILESTONES[hi];
 return lo.km+(next.km-lo.km)*(a-lo.altitude)/(next.altitude-lo.altitude);
}
export const formatAltitude=a=>altitudeKm(a).toFixed(1);
export function resultGoal(distance){const km=altitudeKm(distance);return km>=200?"Орбита взята! Следующий запуск — снова с Земли.":`ДО ${km<100?'КОСМОСА':'ОРБИТЫ'}: ${((km<100?100:200)-km).toFixed(1)} КМ`;}
export function recordFlight(state,result){state.bestAltitude=Math.max(state.bestAltitude,result.distance);if(result.reason==='orbit')state.orbitUnlocked=true;}
export function speedKmh(run){return Math.round(27600*Math.pow(clamp(run.altitude/ROUTE_END,0,1),.72));}
export const maxLevel=key=>key==='hull'?1:12;
export function protectionText(run){return '◆'.repeat(run.sections)+'◇'.repeat(run.stats.sections-run.sections);}
export function collisionCopy(run){return run.sections===1?"Ещё одно столкновение — и ракета развалится.":`Осталось ${run.sections} защитные секции.`;}
export function armCollisionTutorial(run,state,session){run.pauseOnCollision=!state.collisionTutorialSuppressed&&!session.shown;}
export function acceptCollisionTutorial(run,session){if(!run.pendingCollisionTutorial)return false;session.shown=true;run.pendingCollisionTutorial=false;return true;}
export function resumeCollisionTutorial(run,state,suppress=false){
 if(suppress)state.collisionTutorialSuppressed=true;
 run.paused=false;run.accumulator=0;run.targetX=run.x;run.pendingCollisionTutorial=false;
}
export function environmentFor(a){const km=altitudeKm(a);return km<4?'city':km<8?'cloud':km<12?'storm':km<50?'stratosphere':km<100?'upper':'space';}
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const TUTORIAL_ORDER = ["fuel","scrap","salvage"];
export const TUTORIAL_COPY = {
 fuel:{title:"ТОПЛИВО",text:"Канистра даёт +6 с. Ракета поднимается сама: веди палец только в стороны и выбирай проход."},
 scrap:{title:"ЛОМ",text:"Валюта для деталей. Забери в гараж и улучши ракету."},
 salvage:{title:"ЦЕННЫЙ ЛОМ",text:"В ящике больше лома. Рядом опасность — стоит ли рисковать?"},
};
export function createInitialState(){return {saveVersion:5,scrap:0,launches:0,bestAltitude:0,claimedMilestones:[],orbitBonusClaimed:false,orbitUnlocked:false,collisionTutorialSuppressed:false,migrationRefund:0,upgrades:{...INITIAL_LEVELS},tutorials:Object.fromEntries(TUTORIAL_ORDER.map(k=>[k,false]))};}
export function completeTutorial(state,type){
 if(type==="skip")for(const k of TUTORIAL_ORDER)state.tutorials[k]=true;
 else if(TUTORIAL_ORDER.includes(type))state.tutorials[type]=true;
}
export function progressFor(best,current=null){
 const record=clamp(best,0,ROUTE_END);
 const altitude=current===null?null:clamp(current,0,ROUTE_END);
 const frontier=layerFor(record),next=nextMilestone(record);
 const routePoint=altitude??record,routeFrontier=layerFor(routePoint);
 return {record,altitude,frontier,next,remaining:next?next.altitude-record:0,orbitRemaining:ROUTE_END-record,
  nearby:nextMilestone(routePoint),
  route:MILESTONES.map(m=>({...m,status:m.altitude<routeFrontier.altitude?"completed":m.altitude===routeFrontier.altitude?"current":"future"}))};
}
export function sanitizeState(input){
 const r=createInitialState(),number=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 const legacy=!!input&&input.saveVersion!==5;
 r.scrap=Math.floor(number(input?.scrap));r.launches=Math.floor(number(input?.launches));
 const oldBest=clamp(number(input?.bestAltitude),0,legacy?1000:ROUTE_END);
 r.bestAltitude=oldBest*(legacy?2:1);
 for(const k of UPGRADE_ORDER)r.upgrades[k]=clamp(Math.floor(number(input?.upgrades?.[k])),0,maxLevel(k));
 for(const k of TUTORIAL_ORDER)r.tutorials[k]=input?.tutorials?.[k]===true;
 r.collisionTutorialSuppressed=input?.collisionTutorialSuppressed===true;
 r.migrationRefund=Math.floor(number(input?.migrationRefund));
 if(legacy){
  const oldHull=clamp(Math.floor(number(input?.upgrades?.hull)),0,12);
  // Keep the first earned Hull as the complete module. Refund extra levels
  // at the last published legacy schedule (no historical receipts exist).
  const refund=Array.from({length:Math.max(0,oldHull-1)},(_,i)=>COST_BANDS[i+1]-5).reduce((a,b)=>a+b,0);
  r.scrap+=refund;r.migrationRefund=refund;
  // Do not pay new zone bonuses retroactively, including older claim-array saves.
  r.claimedMilestones=MILESTONES.slice(1,5).filter(m=>m.altitude<=r.bestAltitude).map(m=>m.altitude);
 }else r.claimedMilestones=MILESTONES.slice(1,5).filter(m=>Array.isArray(input?.claimedMilestones)&&input.claimedMilestones.includes(m.altitude)).map(m=>m.altitude);
 r.orbitBonusClaimed=input?.orbitBonusClaimed===true||(legacy&&oldBest>=1000);
 r.orbitUnlocked=input?.orbitUnlocked===true||r.orbitBonusClaimed;
 return r;
}
export const COST_BANDS=[60,110,190,310,480,700,980,1330,1750,2250,2840,3520];
export function upgradeCost(key,level){if(!UPGRADES[key])throw new Error("Unknown upgrade: "+key);if(key==="hull")return 300;return (COST_BANDS[clamp(Math.floor(level),0,11)]??3520)+UPGRADES[key].baseCost-60;}
export function statsFor(levels){
 const l={...INITIAL_LEVELS,...levels};
 return {climb:20*(1+.32*l.engine/(l.engine+3)),fuel:36+l.fuel*3.5,sections:2+Number(l.hull>0),
 fuelLoss:1.2,cargoLoss:.16,
 steering:1.4+l.guidance*.20,response:12+l.guidance*3,drift:1/(1+l.guidance*.65),
 recovery:.55/(1+l.engine*.25+l.guidance*.2),magnet:.072+Math.min(.19,l.magnet*.035)};
}
export const FIXED_STEP=1/120;
export const FUEL_PICKUP=6;
export function createControlTimeline(initial={x:.5}){
 let active=initial,pending=[];
 return {
  push(time,control){pending.push({time,control:{...control}});},
  sample(time){while(pending.length&&pending[0].time<=time+1e-10)active=pending.shift().control;return active;},
  reset(control){active={...control};pending=[];},
 };
}
export function pointerControl(x,y,width){
 return {x:clamp(x/width,.09,.91)};
}
export function keyboardControl(keys){
 return {horizontal:Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"))};
}
export function altitudeGauge(altitude,best){
 return {fill:altitudeKm(altitude)/200,best:altitudeKm(best)/200,ticks:MILESTONES.slice(1).map(m=>({...m,position:m.km/200}))};
}
// Shorter visual look-ahead gives energetic flow without accelerating altitude/time.
export function cameraView(run,height){
 // +40% pixels/sec versus the accepted build, independent of climb/engine level.
 const flow=(height*.76-120)/2.4*1.40;
 const scale=flow/run.stats.climb;
 const worldY=altitude=>height*.60-(altitude-run.cameraAltitude)*scale;
 return {scale,flow,rocketY:worldY(run.altitude),lookAhead:(height*.60-95)/flow,worldY};
}
export function effectText(key,level){
 const s=statsFor({...INITIAL_LEVELS,[key]:level});
 return ({engine:`Эффективность подъёма ×${(s.climb/20).toFixed(2)}`,fuel:`${s.fuel.toFixed(1)} с стартового топлива`,
 hull:`${s.sections} защитные секции · один удар = одна секция`,
 guidance:`Отклик ×${(s.response/12).toFixed(2)} · меньше снос`,magnet:`Радиус ${Math.round(s.magnet*100)}% ширины`})[key]??"";
}
export function layerFor(a){return [...MILESTONES].reverse().find(m=>a>=m.altitude)??MILESTONES[0];}
export function nextMilestone(a){return MILESTONES.find(m=>m.altitude>a)??null;}
export function seededRandom(seed){
 let value=seed>>>0;
 return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
// Precompute fair chunks as data; activate them progressively, never an icon field.
export const LOOK_AHEAD_SECONDS = 2.4;
export const STAGE_RULES=[
 {gap:.44,interval:3.0},{gap:.42,interval:2.9},
 {gap:.40,interval:2.8},{gap:.38,interval:2.8},{gap:.36,interval:2.7},
];
export function objectX(o,run){return o.x+(o.motion??0)*Math.sin(run.time*1.6+(o.phase??0));}
export function hazardActive(o,run){return !o.temporary||(o.altitude-run.altitude<=run.stats.climb*.65&&o.altitude-run.altitude>=-run.stats.climb*.22);}
export function damageState(run){return run.sections<=1?3:run.sections<run.stats.sections?2:0;}
export const ARCHETYPES=['single-side','alternating','center','crosser','funnel','offset-double','temporary','reward-pocket','fuel-risk','breathing'];
export const STAGE_PATTERNS=[
 ['single-side','crosser','center','breathing','reward-pocket','breathing'],
 ['crosser','single-side','funnel','breathing','fuel-risk','center','breathing','reward-pocket'],
 ['center','breathing','crosser','offset-double','reward-pocket','fuel-risk','breathing'],
 ['temporary','breathing','single-side','crosser','funnel','breathing','reward-pocket'],
 ['crosser','alternating','breathing','reward-pocket','temporary','single-side','breathing','fuel-risk','center','breathing'],
];
// A time-independent corridor certificate includes the full motion envelope.
// It proves geometry; the clean physics replay additionally checks steering/fuel.
export function validateCourse(course,stats=statsFor({})){
 const rows=course.filter(o=>o.type==='route');
 if(!rows.length)return course.length===0;
 let previous=.5,previousAltitude=0;
 for(const row of rows){
  const dt=(row.altitude-previousAltitude)/stats.climb;
  if(row.safeX<.09||row.safeX>.91||dt<Math.abs(row.safeX-previous)/stats.steering+.35)return false;
  for(const o of course.filter(o=>o.type==='hazard'&&Math.abs(o.altitude-row.altitude)<.001)){
   if(Math.abs(o.x-row.safeX)<o.width/2+.035+(o.motion??0)+.02)return false;
  }
  previous=row.safeX;previousAltitude=row.altitude;
 }
 for(const o of course.filter(o=>o.type==='hazard')){
  const row=rows.findLast(p=>p.altitude<=o.altitude+.001);
  if(!row||Math.abs(o.x-row.safeX)<o.width/2+.035+(o.motion??0)+.02)return false;
 }
 return true;
}
export function createCourse(rng=Math.random,stats=statsFor({})){
 const objects=[];let altitude=stats.climb*3.2,chunk=0,lastSide=rng()<.5?-1:1;
 const stageCounts=[0,0,0,0,0];
 while(altitude<ROUTE_END-stats.climb*.7){
  const stage=Math.min(4,MILESTONES.findLastIndex(m=>altitude>=m.altitude)),rule=STAGE_RULES[stage];
  const side=-lastSide;lastSide=side;
  let safeX=side<0?.20:.80;
  const patterns=STAGE_PATTERNS[stage],n=stageCounts[stage]++,pattern=patterns[(n+Math.floor(chunk/12))%patterns.length];
  const common={chunk,pattern,stage,phase:chunk*.7,active:false,done:false};
  const add=(type,x,a,extra={})=>objects.push({id:objects.length,...common,type,x,altitude:a,revealAltitude:Math.max(0,a-stats.climb*LOOK_AHEAD_SECONDS),...extra});
  const skin=(kind,a=altitude)=>{
   const env=environmentFor(a);
   if(env==='space')return kind==='moving'?'satellite':chunk%2?'spent-stage':'meteor';
   if(env==='upper')return kind==='moving'?'spent-stage':'research';
   if(env==='stratosphere')return kind==='moving'?'balloon':'research';
   if(env==='storm')return 'storm';
   if(env==='cloud')return kind==='moving'?'glider':'cloud';
   return kind==='moving'?'hook':chunk%2?'crane':'container';
  };
  const hazard=(x,width,a,impact='serious',extra={})=>add('hazard',x,a,{width,impact,skin:skin(extra.motion?'moving':'solid',a),...extra});
  const route=(x,a)=>add('route',x,a,{safeX:x,gap:rule.gap});
  const gate=(x,a,gap=rule.gap)=>{
   const left=x-gap/2,right=x+gap/2;
   if(left>.01)hazard(left/2,left,a,stage>=3?'heavy':'serious');
   if(right<.99)hazard((right+1)/2,1-right,a,'serious');
   route(x,a);
  };
  let span=0;
  if(pattern==='single-side'){hazard(side<0?.70:.30,.60,altitude);route(safeX,altitude);}
  else if(pattern==='center'||pattern==='reward-pocket'||pattern==='fuel-risk'){
   hazard(.50,pattern==='fuel-risk'?.44:.38,altitude,pattern==='fuel-risk'?'heavy':'serious');route(safeX,altitude);
   if(pattern==='reward-pocket')add('salvage',side<0?.25:.75,altitude+stats.climb*.28);
  }else if(pattern==='crosser'){
   hazard(side<0?.65:.35,.28,altitude,'serious',{motion:.10,skin:skin('moving')});route(safeX,altitude);
  }else if(pattern==='alternating'){
   gate(safeX,altitude,rule.gap+.03);span=1.35;
   safeX=1-safeX;gate(safeX,altitude+stats.climb*span,rule.gap);
  }else if(pattern==='offset-double'){
   hazard(safeX<.5?.66:.34,.48,altitude);route(safeX,altitude);span=1.15;
   safeX=1-safeX;hazard(safeX<.5?.66:.34,.48,altitude+stats.climb*span,'heavy');route(safeX,altitude+stats.climb*span);
  }else if(pattern==='funnel'){
   gate(safeX,altitude,.44);span=.8;gate(safeX,altitude+stats.climb*span,rule.gap);
  }else if(pattern==='temporary'){
   hazard(.50,.46,altitude,'heavy',{temporary:true,skin:environmentFor(altitude)==='storm'?'lightning':'orbital-field'});route(safeX,altitude);
  }else if(pattern==='breathing'){
   // A distinct empty interval: no colliders, recover line and seek one resource.
   safeX=.5;route(safeX,altitude);
  }
  // Small cargo, and fuel on a precision route; nothing is awarded automatically.
  const type=chunk%3===0||pattern==='fuel-risk'||pattern==='breathing'?'fuel':'scrap';
  const pickupX=safeX+(safeX<.5?.08:safeX>.5?-.08:.08);
  add(type,pickupX,altitude+stats.climb*(span+.35));
  if(pattern==='fuel-risk')hazard(safeX<.5?.39:.61,.14,altitude+stats.climb*.35,'light');
  altitude+=stats.climb*(rule.interval+span+rng()*.12);chunk++;
 }
 if(!validateCourse(objects,stats))throw new Error("Unreachable generated course");
 return objects.sort((a,b)=>a.altitude-b.altitude);
}
export function revealObjects(run){
 for(const o of run.objects)if(run.altitude>=(o.revealAltitude??0))o.active=true;
}
export function tutorialCandidate(run,flags,lastChunk=-1){
 return TUTORIAL_ORDER.filter(k=>!flags[k]).map(type=>
  run.objects.find(o=>o.active&&!o.done&&o.type===type&&(o.chunk??0)>lastChunk&&o.altitude-run.altitude>run.stats.climb*.9)
 ).find(Boolean)??null;
}
export function createFlight(levels,course=null){
 const stats=statsFor(levels);
 return {stats,objects:(course??createCourse(Math.random,stats)).map(o=>({...o,active:false,done:false})),altitude:0,peakAltitude:0,cameraAltitude:0,time:0,tick:0,accumulator:0,x:.5,vx:0,vy:stats.climb,targetX:.5,
 fuel:stats.fuel,sections:stats.sections,cargo:0,salvage:0,scrapPickups:0,fuelPickups:0,hits:0,
 fuelLost:0,cargoLost:0,slow:0,invulnerable:0,paused:false,pauseOnCollision:false,pendingCollisionTutorial:false,ended:null,events:[]};
}
export function stepFlight(r,dt,input=.5){
 if(r.ended||r.paused)return;
 if(!Number.isFinite(dt)||dt<0)throw new Error("Invalid elapsed time");
 r.accumulator+=dt;
 while(r.accumulator+1e-10>=FIXED_STEP&&!r.ended&&!r.paused){
  const d=FIXED_STEP;r.accumulator=Math.max(0,r.accumulator-d);
  const supplied=typeof input==="function"?input(r):input;
  const control=typeof supplied==="number"?{x:supplied}:supplied;
  if(Number.isFinite(control.x))r.targetX=clamp(control.x,.09,.91);
  r.targetX=clamp(r.targetX+(control.horizontal??0)*r.stats.steering*d,.09,.91);
  r.time=++r.tick*d;r.invulnerable=Math.max(0,r.invulnerable-d);r.slow=Math.max(0,r.slow-d);
  const storm=environmentFor(r.altitude)==='storm';
  const drift=Math.sin(r.time*2.1)*(.018+(storm?.095:0))*r.stats.drift;
  const desired=clamp((r.targetX-r.x)*r.stats.response,-r.stats.steering,r.stats.steering)+drift;
  r.vx+=(desired-r.vx)*Math.min(1,d*r.stats.response);r.x=clamp(r.x+r.vx*d,.09,.91);
  const speed=r.stats.climb*(r.slow>0?.55:1);
  r.vy+=(speed-r.vy)*Math.min(1,d*8);
  r.altitude=clamp(r.altitude+r.vy*d,0,ROUTE_END);r.peakAltitude=Math.max(r.peakAltitude,r.altitude);
  r.fuel=Math.max(0,r.fuel-d);if(r.fuel<1e-9)r.fuel=0;
  r.cameraAltitude=r.altitude;
  revealObjects(r);
  for(const o of r.objects){
   if(o.done||!o.active||o.type==='route')continue;
   const dy=o.altitude-r.altitude;
   const radius=o.type==="hazard"?(o.width??.10)/2+.035:o.type==="fuel"?.042:r.stats.magnet;
   if(Math.abs(dy)>r.stats.climb*.12||Math.abs(r.x-objectX(o,r))>radius)continue;
   if(o.type==="hazard"&&(r.invulnerable>0||!hazardActive(o,r)))continue;
   o.done=true;
   if(o.type==="hazard"){
    const impact=o.impact??'serious';
    r.hits++;r.sections=Math.max(0,r.sections-1);r.lastImpact={impact,time:r.time,sectionsLost:1};
    const loss=Math.min(r.fuel,r.stats.fuelLoss),drop=Math.round(r.cargo*r.stats.cargoLoss);
    r.fuel-=loss;r.fuelLost+=loss;r.cargo-=drop;r.cargoLost+=drop;
    r.slow=r.stats.recovery;r.invulnerable=.8;r.vx+=(r.x<=o.x?-1:1)*.40;
    r.events.push({type:"hazard",impact,sectionsLost:1,x:r.x,altitude:r.altitude,text:`−1 ЗАЩИТНАЯ СЕКЦИЯ · −${loss.toFixed(1)} с · −${drop} лома`});
    if(r.pauseOnCollision&&r.sections>0){r.pauseOnCollision=false;r.pendingCollisionTutorial=true;r.paused=true;r.accumulator=0;break;}
   }else if(o.type==="fuel"){
    const before=r.fuel;r.fuel+=FUEL_PICKUP;r.fuelPickups++;r.events.push({type:"fuel",x:o.x,altitude:o.altitude,before,after:r.fuel,gain:FUEL_PICKUP,text:`+${FUEL_PICKUP.toFixed(1)} с ТОПЛИВА`});
   }else{
    const amount=o.type==="salvage"?4:1;r.cargo+=amount;
    if(o.type==="salvage")r.salvage++;else r.scrapPickups++;
    r.events.push({type:o.type,x:o.x,altitude:o.altitude,text:`+${amount} ЛОМА`});
   }
  }
  r.ended=r.sections<=0?"hull":r.fuel<=0?"fuel":r.altitude>=ROUTE_END?"orbit":null;
 }
}
export const MILESTONE_BONUSES={200:6,650:8,1050:10,1250:12};
export function flightResult(r,launchIndex=0,claimed=[],orbitClaimed=false){
 const distance=r.peakAltitude,base=12+Math.floor(altitudeKm(distance)*.15);
 const milestones=MILESTONES.slice(1,5).filter(m=>m.altitude<=distance&&!claimed.includes(m.altitude)).map(m=>m.altitude);
 const milestoneBonus=milestones.reduce((sum,a)=>sum+MILESTONE_BONUSES[a],0);
 const orbitBonus=r.ended==='orbit'&&!orbitClaimed?24:0;
 const normal=base+r.cargo+milestoneBonus+orbitBonus,reward=launchIndex===0?Math.max(65,normal):normal;
 return {distance,distanceKm:altitudeKm(distance),sectionsLost:r.stats.sections-r.sections,endAltitude:r.altitude,reward,base,cargo:r.cargo,salvage:r.salvage,hits:r.hits,fuelPickups:r.fuelPickups,duration:r.time,firstFlightBonus:reward-normal,
 milestones,milestoneBonus,orbitBonus,
 safeLanding:r.ended!=="hull",reason:r.ended,next:nextMilestone(distance),
 landingLabel:r.ended==="orbit"?"ОРБИТА ДОСТИГНУТА!":r.ended==="hull"?"КОРАБЛЬ УНИЧТОЖЕН":"ТОПЛИВО ЗАКОНЧИЛОСЬ"};
}
