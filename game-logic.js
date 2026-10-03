export const UPGRADE_ORDER = ["engine","fuel","hull","guidance","magnet"];
export const UPGRADES = {
 engine:{name:"Двигатель",baseCost:65,description:"Выше на том же топливе. После удара тяга восстанавливается быстрее."},
 fuel:{name:"Топливный бак",baseCost:60,description:"Больше топлива на старте — дольше летишь и выше поднимаешься."},
 hull:{name:"Корпус",baseCost:55,description:"Прощает ошибки: выдерживает больше ударов, теряет меньше топлива и лома."},
 guidance:{name:"Наведение",baseCost:70,description:"Точнее рулишь: меньше сносит ветром, быстрее стабилизируется после удара."},
 magnet:{name:"Магнит",baseCost:50,description:"Собирает лом издалека — не нужно подлетать так близко к опасности."},
};
export const INITIAL_LEVELS=Object.freeze(Object.fromEntries(UPGRADE_ORDER.map(k=>[k,0])));
export const MILESTONES=[{altitude:0,name:"Свалка"},{altitude:180,name:"Город"},{altitude:360,name:"Облака"},{altitude:560,name:"Шторм"},{altitude:780,name:"Стратосфера"},{altitude:1000,name:"Орбита"}];
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const TUTORIAL_ORDER = ["fuel","scrap","hazard","salvage"];
export const TUTORIAL_COPY = {
 fuel:{title:"ТОПЛИВО",text:"Продлевает полёт. Собирай, чтобы подняться выше."},
 scrap:{title:"ЛОМ",text:"Валюта для деталей. Забери в гараж и улучши ракету."},
 hazard:{title:"ОБЛОМОК",text:"Удар отнимет прочность, топливо и груз. Облетай."},
 salvage:{title:"ЦЕННЫЙ ЛОМ",text:"В ящике больше лома. Рядом опасность — стоит ли рисковать?"},
};
export function createInitialState(){return {scrap:0,launches:0,bestAltitude:0,upgrades:{...INITIAL_LEVELS},tutorials:Object.fromEntries(TUTORIAL_ORDER.map(k=>[k,false]))};}
export function completeTutorial(state,type){
 if(type==="skip")for(const k of TUTORIAL_ORDER)state.tutorials[k]=true;
 else if(TUTORIAL_ORDER.includes(type))state.tutorials[type]=true;
}
export function progressFor(best,current=null){
 const record=clamp(Math.floor(best),0,1000);
 const altitude=current===null?null:clamp(Math.floor(current),0,1000);
 const frontier=layerFor(record),next=nextMilestone(record);
 const routePoint=altitude??record,routeFrontier=layerFor(routePoint);
 return {record,altitude,frontier,next,remaining:next?next.altitude-record:0,orbitRemaining:1000-record,
  nearby:nextMilestone(routePoint),
  route:MILESTONES.map(m=>({...m,status:m.altitude<routeFrontier.altitude?"completed":m.altitude===routeFrontier.altitude?"current":"future"}))};
}
export function sanitizeState(input){
 const r=createInitialState(),number=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 r.scrap=Math.floor(number(input?.scrap));r.launches=Math.floor(number(input?.launches));r.bestAltitude=clamp(Math.floor(number(input?.bestAltitude)),0,1000);
 for(const k of UPGRADE_ORDER)r.upgrades[k]=clamp(Math.floor(number(input?.upgrades?.[k])),0,12);
 for(const k of TUTORIAL_ORDER)r.tutorials[k]=input?.tutorials?.[k]===true;
 return r;
}
export function upgradeCost(key,level){if(!UPGRADES[key])throw new Error("Unknown upgrade: "+key);return Math.round(UPGRADES[key].baseCost*1.45**level/5)*5;}
export function statsFor(levels){
 const l={...INITIAL_LEVELS,...levels};
 return {climb:28*(1+l.engine*.16),fuel:18+l.fuel*3.5,hull:100+l.hull*28,
 fuelLoss:2.6/(1+l.hull*.25),cargoLoss:.16/(1+l.hull*.3),
 steering:1.05+l.guidance*.24,response:8+l.guidance*3,drift:1/(1+l.guidance*.65),
 recovery:.95/(1+l.engine*.25+l.guidance*.2),magnet:.072+Math.min(.19,l.magnet*.035)};
}
export function effectText(key,level){
 const s=statsFor({...INITIAL_LEVELS,[key]:level});
 return ({engine:`${s.climb.toFixed(1)} м на 1 с топлива`,fuel:`${s.fuel.toFixed(1)} с стартового топлива`,
 hull:`${s.hull} прочности · удар −${s.fuelLoss.toFixed(1)} с`,
 guidance:`Отклик ×${(s.response/8).toFixed(2)} · меньше снос`,magnet:`Радиус ${Math.round(s.magnet*100)}% ширины`})[key]??"";
}
export function layerFor(a){return [...MILESTONES].reverse().find(m=>a>=m.altitude)??MILESTONES[0];}
export function nextMilestone(a){return MILESTONES.find(m=>m.altitude>a)??null;}
export function seededRandom(seed){
 let value=seed>>>0;
 return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
// Precompute fair chunks as data; activate them progressively, never an icon field.
export const LOOK_AHEAD_SECONDS = 2.4;
export function createCourse(rng=Math.random,stats=statsFor({})){
 const objects=[];
 let contactTime=3.2,chunk=0,lastRisk=-9;
 while(contactTime*stats.climb<985){
  const roll=rng();
  let pattern=chunk===0?"fuel":chunk===1?"junk":chunk===2?"gate":chunk===3?"salvage":
   roll<.5?"fuel":roll<.72?"junk":roll<.9?"gate":"salvage";
  if(pattern==="salvage"&&chunk-lastRisk<3)pattern="fuel";
  if(pattern==="salvage")lastRisk=chunk;
  const flip=rng()<.5;
  const left=.21+(rng()-.5)*.06,right=.79+(rng()-.5)*.06;
  const rewardX=flip?left:right,safeX=flip?right:left;
  const y=contactTime*stats.climb;
  let entries;
  if(pattern==="fuel")entries=[["fuel",rewardX,y],["scrap",safeX,y]];
  else if(pattern==="junk")entries=[["hazard",rewardX,y],["scrap",safeX,y]];
  else if(pattern==="gate")entries=[
   ["hazard",rewardX,y],
   ["fuel",rewardX+(flip?.14:-.14),y+stats.climb*.9],
   ["scrap",safeX,y+stats.climb*.3],
  ];
  else entries=[["salvage",rewardX,y],["hazard",rewardX,y+stats.climb*.9],["fuel",safeX,y]];
  const revealAltitude=Math.max(0,y-stats.climb*LOOK_AHEAD_SECONDS);
  for(const [type,x,altitude]of entries)
   objects.push({id:objects.length,type,x,altitude,chunk,pattern,revealAltitude,active:false,done:false});
  // An extra two seconds after every fourth decision creates an actual breathing gap.
  contactTime+=4.0+rng()*.45+(chunk%4===3?2:0);
  chunk++;
 }
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
 return {stats,objects:(course??createCourse(Math.random,stats)).map(o=>({...o,active:false,done:false})),altitude:0,time:0,x:.5,vx:0,
 fuel:stats.fuel,hull:stats.hull,cargo:0,salvage:0,scrapPickups:0,fuelPickups:0,hits:0,
 fuelLost:0,cargoLost:0,slow:0,invulnerable:0,paused:false,ended:null,events:[]};
}
export function stepFlight(r,dt,target=.5){
 if(r.ended||r.paused)return;
 let remaining=clamp(dt,0,.25);
 while(remaining>1e-8&&!r.ended){
  const d=Math.min(remaining,1/120);remaining-=d;
  r.time+=d;r.invulnerable=Math.max(0,r.invulnerable-d);r.slow=Math.max(0,r.slow-d);
  const storm=r.altitude>=560&&r.altitude<780;
  const drift=Math.sin(r.time*2.1)*(.018+(storm?.095:0))*r.stats.drift;
  const desired=clamp((clamp(target,.09,.91)-r.x)*r.stats.response,-r.stats.steering,r.stats.steering)+drift;
  r.vx+=(desired-r.vx)*Math.min(1,d*r.stats.response);r.x=clamp(r.x+r.vx*d,.09,.91);
  const speed=r.stats.climb*(r.altitude>=780?.91:1)*(r.slow>0?.45:1);
  r.altitude=Math.min(1000,r.altitude+speed*d);r.fuel=Math.max(0,r.fuel-d);
  revealObjects(r);
  for(const o of r.objects){
   if(o.done||!o.active)continue;
   const dy=o.altitude-r.altitude;
   if(dy< -10){o.done=true;continue;}
   const radius=o.type==="hazard"?.083:o.type==="fuel"?.073:r.stats.magnet;
   if(Math.abs(dy)>8||Math.abs(r.x-o.x)>radius)continue;
   if(o.type==="hazard"&&r.invulnerable>0)continue;
   o.done=true;
   if(o.type==="hazard"){
    r.hits++;r.hull=Math.max(0,r.hull-24);
    const loss=Math.min(r.fuel,r.stats.fuelLoss),drop=Math.round(r.cargo*r.stats.cargoLoss);
    r.fuel-=loss;r.fuelLost+=loss;r.cargo-=drop;r.cargoLost+=drop;
    r.slow=r.stats.recovery;r.invulnerable=.8;r.vx+=(r.x<=o.x?-1:1)*.55;
    r.events.push({type:"hazard",x:o.x,text:`УДАР: −${loss.toFixed(1)} с · −24 корпуса · −${drop} лома`});
   }else if(o.type==="fuel"){
    r.fuel+=1.4;r.fuelPickups++;r.events.push({type:"fuel",x:o.x,text:"+1.4 с ТОПЛИВА"});
   }else{
    const amount=o.type==="salvage"?32:10;r.cargo+=amount;
    if(o.type==="salvage")r.salvage++;else r.scrapPickups++;
    r.events.push({type:o.type,x:o.x,text:`+${amount} ЛОМА`});
   }
  }
  r.ended=r.hull<=0?"hull":r.fuel<=0?"fuel":r.altitude>=1000?"orbit":null;
 }
}
export function flightResult(r,launchIndex=0){
 const distance=Math.floor(r.altitude),base=25+Math.floor(distance*.055),normal=base+r.cargo,reward=launchIndex===0?Math.max(65,normal):normal;
 return {distance,reward,base,cargo:r.cargo,salvage:r.salvage,hits:r.hits,fuelPickups:r.fuelPickups,duration:r.time,firstFlightBonus:reward-normal,
 safeLanding:r.ended!=="hull",reason:r.ended,next:nextMilestone(distance),
 landingLabel:r.ended==="orbit"?"Орбита достигнута!":r.ended==="hull"?"Корпус развалился":"Топливо закончилось"};
}