import {TEMPLATES,createPuzzle,rotateTile,retryPuzzle,powerPath,tileMask,DIRECTIONS} from './circuit-logic.js';
import {RECIPE,pendingJobs,currentJob,recipeComplete,nextPart,prepareSalvageReward,claimSalvageReward,assembleEngine} from './orbit-logic.js';

export function wireSvg(tile) {
 const mask=tileMask(tile);
 const ends={1:[32,0],2:[64,32],4:[32,64],8:[0,32]};
 if(tile.kind==='blocked')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="burnt" d="m24 24 16 16m0-16-16 16"/></svg>';
 const wires=DIRECTIONS.filter(d=>mask&d.bit).map(d=>`<path class="wire" d="M32 32L${ends[d.bit].join(' ')}"/>`).join('');
 const symbol=tile.kind==='source'?'<circle class="power-core" cx="32" cy="32" r="13"/><path class="source-symbol" d="m34 21-9 13h8l-4 10 12-15h-9z"/>':tile.kind==='target'?'<rect class="compartment" x="17" y="17" width="30" height="30" rx="5"/><path class="compartment-lid" d="M32 18v28"/><circle class="found-part" cx="32" cy="32" r="8"/>':'<circle class="joint" cx="32" cy="32" r="5"/>';
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${wires}${symbol}</svg>`;
}

export function createOrbitUi({getState,save,setMode,enterGarage,reducedMotion=false,document:doc=globalThis.document,requestFrame=globalThis.requestAnimationFrame,now=()=>performance.now()}) {
 const ids=['dockScreen','puzzleScreen','recipeParts','recipeNote','assembleEngine','jobCount','jobTitle','jobObjective','startSalvage','moonTeaser','dockBack','puzzleTitle','droneEnergy','droneEnergyBar','puzzleStatusTitle','puzzleStatusText','puzzleRetry','claimComponent','circuitBoard','puzzleBack','locationLabel'];
 const el=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));
 let puzzle=null,jobId=null,phase='playing',flowPath=[],flowProgress=0,token=0;
 const partName=key=>RECIPE.find(p=>p.key===key)?.name??'';
 function dock() {
  const state=getState();if(!state.orbitUnlocked)return;
  token++;puzzle=null;state.dockIntroSeen=true;save();setMode('dock');
  el.dockScreen.hidden=false;el.puzzleScreen.hidden=true;el.locationLabel.textContent='ОРБИТАЛЬНЫЙ ДОК · 200 КМ';
  el.recipeParts.innerHTML=RECIPE.map(p=>`<div class="recipe-part${state.rareParts[p.key]===p.required?' ready':''}"><span>${p.name}</span><strong>${state.rareParts[p.key]} / ${p.required}</strong></div>`).join('');
  el.recipeNote.textContent=state.vacuumEngineBuilt?'ДВИГАТЕЛЬ СОБРАН · ДЕТАЛИ УСТАНОВЛЕНЫ':recipeComplete(state)?'Все детали на месте. Пора собрать новый двигатель.':'Редкие детали из орбитальных находок. Не покупаются за лом.';
  el.assembleEngine.hidden=!recipeComplete(state)||state.vacuumEngineBuilt;
  el.moonTeaser.hidden=!state.vacuumEngineBuilt;
  const job=currentJob(state);
  el.jobCount.textContent=`ОБЪЕКТОВ ДЛЯ РАЗБОРА: ${pendingJobs(state)}`;
  el.startSalvage.hidden=!job||recipeComplete(state)||state.vacuumEngineBuilt;
  el.startSalvage.textContent=state.salvageReady?'ЗАБРАТЬ НАЙДЕННУЮ ДЕТАЛЬ':'НАЧАТЬ РЕМОНТ / РАЗБОР';
  el.jobTitle.textContent=state.vacuumEngineBuilt?'ПЕРВАЯ СБОРКА ЗАВЕРШЕНА':recipeComplete(state)?'ПОСЛЕДНИЙ БОЛТ ОСТАЛСЯ':job?TEMPLATES[job.template].name:'ДОБУДЬТЕ НОВЫЙ ОБЪЕКТ ДЛЯ РАЗБОРА';
  el.jobObjective.textContent=state.vacuumEngineBuilt?'Док открыт навсегда. Земля остаётся доступна; собранные находки хранятся здесь.':recipeComplete(state)?'Соберите двигатель из пяти найденных деталей.':job?'Соедини питание с отсеком. Внутри — недостающая деталь двигателя.':'Достигните Орбиты ещё раз. Новый финиш — новая находка.';
  el.dockBack.textContent=!job&&!recipeComplete(state)?'В ГАРАЖ · К НОВОМУ ЗАПУСКУ':'В ГАРАЖ';
  el.dockScreen.dataset.built=state.vacuumEngineBuilt;
  doc.defaultView?.scrollTo({top:0,behavior:'instant'});el.dockBack.focus({preventScroll:true});
 }
 function updateBoard() {
  const power=powerPath(puzzle.board);
  puzzle.board.forEach((tile,index)=>{
   const node=el.circuitBoard.children[index];
   node.innerHTML=wireSvg(tile);
   node.className=`circuit-tile ${tile.kind}`;
   node.dataset.powered=power.powered.has(index);
   node.dataset.flow=phase==='flow'&&flowPath.indexOf(index)>=0&&flowPath.indexOf(index)<=flowProgress;
   node.dataset.revealed=tile.kind==='target'&&phase==='reward';
   if(tile.kind==='connector'){
    node.disabled=phase!=='playing';
    const ports=DIRECTIONS.filter(d=>tileMask(tile)&d.bit).map(d=>({1:'вверх',2:'вправо',4:'вниз',8:'влево'})[d.bit]).join(', ');
    node.setAttribute('aria-label',`Ячейка ${String.fromCharCode(65+Math.floor(index/5))}${index%5+1}: ${ports}; ${power.powered.has(index)?'питание есть':'питания нет'}. Повернуть на 90 градусов`);
   }
  });
 }
 function renderPuzzle() {
  el.droneEnergy.textContent=`${puzzle.energy} / ${puzzle.budget}`;
  el.droneEnergyBar.style.transform=`scaleX(${puzzle.energy/puzzle.budget})`;
  el.puzzleRetry.hidden=phase!=='failed';el.claimComponent.hidden=phase!=='reward';
  el.puzzleStatusTitle.textContent=phase==='failed'?'ЭНЕРГИЯ ДРОНА ИСЧЕРПАНА':phase==='reward'?partName(getState().salvageReady?.part):phase==='flow'?'ПИТАНИЕ ВОССТАНОВЛЕНО':'ПОДАЙ ПИТАНИЕ К ОТСЕКУ';
  el.puzzleStatusText.textContent=phase==='failed'?'Объект сохранён. Повтор бесплатно.':phase==='reward'?'Редкая деталь найдена · для нового двигателя':phase==='flow'?'Источник → цепь → отсек':'Жми провод: поворот 90° = 1 энергия. Светится только питание от источника.';
  el.puzzleScreen.dataset.phase=phase;updateBoard();
 }
 function startPuzzle() {
  const state=getState(),job=currentJob(state);
  if(!state.orbitUnlocked||!job||recipeComplete(state)||state.vacuumEngineBuilt)return;
  token++;jobId=job.id;puzzle=createPuzzle(job.template);phase=state.salvageReady?'reward':'playing';
  if(state.salvageReady){puzzle.board.forEach(tile=>tile.rotation=0);puzzle.status='success';}
  flowPath=[];flowProgress=0;setMode('puzzle');el.dockScreen.hidden=true;el.puzzleScreen.hidden=false;
  el.puzzleTitle.textContent=TEMPLATES[job.template].name;
  el.circuitBoard.replaceChildren();
  puzzle.board.forEach((tile,index)=>{
   const node=doc.createElement(tile.kind==='connector'?'button':'div');
   node.dataset.tile=index;
   if(tile.kind==='connector')node.type='button';
   else {node.setAttribute('role','img');node.setAttribute('aria-label',tile.kind==='source'?'ИСТОЧНИК ПИТАНИЯ':tile.kind==='target'?'ЦЕЛЕВОЙ ОТСЕК':'Выжженная ячейка');}
   el.circuitBoard.append(node);
  });
  renderPuzzle();doc.defaultView?.scrollTo({top:0,behavior:'instant'});el.puzzleBack.focus({preventScroll:true});
 }
 function rotate(index) {
  if(!puzzle||phase!=='playing'||!rotateTile(puzzle,index))return;
  el.circuitBoard.children[index].animate([{transform:'scale(.91)'},{transform:'scale(1)'}],{duration:reducedMotion?1:160});
  if(puzzle.status==='failed')phase='failed';
  if(puzzle.status==='success'){
   if(!prepareSalvageReward(getState(),jobId,puzzle)){dock();return;}
   save();phase='flow';flowPath=powerPath(puzzle.board).path;flowProgress=0;
   const sequence=++token,start=now();
   const tick=time=>{
    if(sequence!==token)return;
    flowProgress=Math.min(flowPath.length-1,Math.floor((time-start)/900*flowPath.length));updateBoard();
    if(time-start>=1200){phase='reward';renderPuzzle();el.claimComponent.focus({preventScroll:true});}
    else requestFrame(tick);
   };
   requestFrame(tick);
  }
  renderPuzzle();
 }
 el.startSalvage.addEventListener('click',startPuzzle);
 el.circuitBoard.addEventListener('click',event=>{const button=event.target.closest('button[data-tile]');if(button)rotate(Number(button.dataset.tile));});
 el.puzzleRetry.addEventListener('click',()=>{if(phase!=='failed')return;puzzle=retryPuzzle(puzzle);phase='playing';renderPuzzle();});
 el.claimComponent.addEventListener('click',()=>{if(phase!=='reward')return;if(claimSalvageReward(getState(),jobId)){save();dock();}});
 el.assembleEngine.addEventListener('click',()=>{if(assembleEngine(getState())){save();dock();el.recipeNote.animate([{backgroundColor:'#baffd3',transform:'scale(1.02)'},{backgroundColor:'transparent',transform:'scale(1)'}],{duration:reducedMotion?1:1200});}});
 el.puzzleBack.addEventListener('click',dock);
 el.dockBack.addEventListener('click',()=>{token++;el.dockScreen.hidden=true;el.puzzleScreen.hidden=true;enterGarage();});
 return {dock,hide(){token++;el.dockScreen.hidden=true;el.puzzleScreen.hidden=true;}};
}
