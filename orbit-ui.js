import {TEMPLATES,createPuzzle,rotateTile,retryPuzzle,powerPath,tileMask,DIRECTIONS} from './circuit-logic.js';
import {RECIPE,pendingJobs,currentJob,recipeComplete,prepareSalvageReward,claimSalvageReward,assembleEngine} from './orbit-logic.js';
import {blueprintSvg,workBaySvg,partSvg} from './dock-art.js';
import {createOrbitTutorial} from './orbit-tutorial.js';

export function wireSvg(tile,rewardPart='core') {
 const mask=tileMask(tile);
 const ends={1:[32,0],2:[64,32],4:[32,64],8:[0,32]};
 if(tile.kind==='blocked')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="burnt" d="m24 24 16 16m0-16-16 16"/></svg>';
 const wires=DIRECTIONS.filter(d=>mask&d.bit).map(d=>`<path class="wire" d="M32 32L${ends[d.bit].join(' ')}"/>`).join('');
 const symbol=tile.kind==='source'?'<circle class="power-core" cx="32" cy="32" r="13"/><path class="source-symbol" d="m34 21-9 13h8l-4 10 12-15h-9z"/>':tile.kind==='relay'?'<path class="relay-core" d="m32 16 15 9v14l-15 9-15-9V25Z"/><text class="module-number" x="32" y="38" text-anchor="middle">R</text>':tile.kind==='target'?(tile.label==='СТАБИЛИЗАТОР'?'<circle class="stabilizer-core" cx="32" cy="32" r="16"/>':`<rect class="compartment" x="16" y="16" width="32" height="32" rx="5"/><path class="compartment-lid" d="M32 17v30"/><g class="found-part" transform="translate(32 32) scale(.65)">${partSvg(rewardPart)}</g>`)+`<text class="module-number" x="32" y="38" text-anchor="middle">${tile.number}</text>`:tile.kind==='fixed'?'<rect class="fixed-joint" x="24" y="24" width="16" height="16" rx="2"/><path class="fixed-mark" d="M27 24v-3a5 5 0 0 1 10 0v3"/>':'<circle class="joint" cx="32" cy="32" r="5"/>';
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${wires}${symbol}</svg>`;
}

export function createOrbitUi({getState,save,setMode,enterGarage,reducedMotion=false,document:doc=globalThis.document,requestFrame=globalThis.requestAnimationFrame,now=()=>performance.now()}) {
 const ids=['dockScreen','puzzleScreen','recipeParts','recipeNote','engineBlueprint','workBay','dockFeedback','assembleEngine','jobCount','jobTitle','jobObjective','startSalvage','moonTeaser','dockBack','puzzleTitle','puzzleLesson','requiredModules','puzzleIntro','droneEnergy','droneEnergyBar','puzzleStatusTitle','puzzleStatusText','puzzleRetry','claimComponent','circuitBoard','puzzleBack','locationLabel'];
 const el=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));
 let puzzle=null,jobId=null,phase='playing',flowPath=[],flowProgress=0,token=0;
 const tutorial=createOrbitTutorial({getState,save,document:doc,onPause:tap=>{
  el.puzzleScreen.dataset.tutorialPaused=true;
  for(const [index,node] of [...el.circuitBoard.children].entries())if(puzzle?.board[index].kind==='connector')node.disabled=index!==tap;
 },onResume:()=>{
  el.puzzleScreen.dataset.tutorialPaused=false;
  for(const [index,node] of [...el.circuitBoard.children].entries())if(puzzle?.board[index].kind==='connector')node.disabled=phase!=='playing';
 }});
 const partName=key=>RECIPE.find(p=>p.key===key)?.name??'';
 function dock({arrivingPart=null,assembled=false}={}) {
  const state=getState();if(!state.orbitUnlocked)return;
  tutorial.cancel();token++;puzzle=null;state.dockIntroSeen=true;save();setMode('dock');
  el.dockScreen.hidden=false;el.puzzleScreen.hidden=true;el.locationLabel.textContent='ОРБИТАЛЬНЫЙ ДОК · 200 КМ';
  el.engineBlueprint.innerHTML=blueprintSvg(state,arrivingPart);
  el.recipeParts.innerHTML=RECIPE.map(p=>`<div class="recipe-part${state.rareParts[p.key]===p.required?' ready':''}"><span>${p.name}</span><strong>${state.rareParts[p.key]} / ${p.required}</strong></div>`).join('');
  el.recipeNote.textContent=state.vacuumEngineBuilt?'ДВИГАТЕЛЬ СОБРАН · ДЕТАЛИ УСТАНОВЛЕНЫ':recipeComplete(state)?'Все детали на месте. Пора собрать новый двигатель.':'Редкие детали из орбитальных находок. Не покупаются за лом.';
  el.assembleEngine.hidden=!recipeComplete(state)||state.vacuumEngineBuilt;
  el.moonTeaser.hidden=!state.vacuumEngineBuilt;
  const job=currentJob(state);
  el.workBay.innerHTML=workBaySvg({job:recipeComplete(state)?null:job,built:state.vacuumEngineBuilt});
  el.jobCount.textContent=`ОБЪЕКТОВ ДЛЯ РАЗБОРА: ${pendingJobs(state)}`;
  el.startSalvage.hidden=!job||recipeComplete(state)||state.vacuumEngineBuilt;
  el.startSalvage.textContent=state.salvageReady?'ЗАБРАТЬ НАЙДЕННУЮ ДЕТАЛЬ':'НАЧАТЬ РАЗБОР';
  el.jobTitle.textContent=state.vacuumEngineBuilt?'СТАПЕЛЬ ГОТОВ К ДАЛЬНЕМУ ПУТИ':recipeComplete(state)?'ПЯТЬ ДЕТАЛЕЙ · ОДИН ДВИГАТЕЛЬ':job?TEMPLATES[job.template].name:'ДОБУДЬТЕ ОБЪЕКТ ДЛЯ РАЗБОРА';
  el.jobObjective.textContent=state.vacuumEngineBuilt?'Двигатель в сборе. Следующий курс ждёт здесь.':recipeComplete(state)?'Все гнёзда заполнены. Осталось замкнуть крепления.':job?'Восстанови отмеченные системы. Деталь займёт своё место в двигателе.':'Достигните Орбиты ещё раз. Стапель ждёт новую находку.';
  el.dockBack.textContent=!job&&!recipeComplete(state)?'В ГАРАЖ · К НОВОМУ ЗАПУСКУ':'В ГАРАЖ';
  el.dockScreen.dataset.built=state.vacuumEngineBuilt;
  el.dockScreen.dataset.work=state.vacuumEngineBuilt?'engine':job&&!recipeComplete(state)?'salvage':'empty';
  el.dockScreen.dataset.assembly=assembled;
  el.dockFeedback.hidden=!arrivingPart&&!assembled;
  if(arrivingPart||assembled){
   el.dockFeedback.textContent=assembled?'ВАКУУМНЫЙ ДВИГАТЕЛЬ Mk I · СОБРАН':`${partName(arrivingPart)} → ГНЕЗДО ДВИГАТЕЛЯ`;
   const epoch=token,start=now();
   const dismiss=time=>{if(epoch!==token)return;if(time-start>=1200)el.dockFeedback.hidden=true;else requestFrame(dismiss);};
   requestFrame(dismiss);
  }
  doc.defaultView?.scrollTo({top:0,behavior:'instant'});el.dockBack.focus({preventScroll:true});
 }
 function updateBoard() {
  const power=powerPath(puzzle.board);
  puzzle.board.forEach((tile,index)=>{
   const node=el.circuitBoard.children[index];
   node.innerHTML=wireSvg(tile,getState().salvageReady?.part);
   node.className=`circuit-tile ${tile.kind}`;
   node.dataset.powered=power.powered.has(index);
   node.dataset.flow=phase==='flow'&&flowPath.includes(index)&&power.depth.get(index)<=flowProgress;
   node.dataset.revealed=tile.kind==='target'&&tile.label==='ЗАМОК'&&phase==='reward';
   node.dataset.required=['target','relay'].includes(tile.kind);
   node.dataset.objective=power.powered.has(index)&&(phase!=='flow'||power.depth.get(index)<=flowProgress);
   if(tile.kind==='connector'){
    node.disabled=phase!=='playing';
    const ports=DIRECTIONS.filter(d=>tileMask(tile)&d.bit).map(d=>({1:'вверх',2:'вправо',4:'вниз',8:'влево'})[d.bit]).join(', ');
    node.setAttribute('aria-label',`Ячейка ${String.fromCharCode(65+Math.floor(index/5))}${index%5+1}: ${ports}; ${power.powered.has(index)?'питание есть':'питания нет'}. Повернуть на 90 градусов`);
   }else node.setAttribute('aria-label',`${tile.label??(tile.kind==='fixed'?'ФИКСИРОВАННЫЙ ПРОВОД':'ВЫЖЖЕННАЯ ЯЧЕЙКА')} ${String.fromCharCode(65+Math.floor(index/5))}${index%5+1}${tile.number?' · '+tile.number:''}${['target','relay'].includes(tile.kind)?' · ОБЯЗАТЕЛЬНО':''}${tile.kind!=='blocked'?(String(node.dataset.objective)==='true'?' · ПИТАНИЕ ЕСТЬ':' · НЕТ ПИТАНИЯ'):''}`);
  });
  el.requiredModules.innerHTML=power.required.map(i=>{const t=puzzle.board[i],lit=power.powered.has(i)&&(phase!=='flow'||power.depth.get(i)<=flowProgress);return `<span data-lit="${lit}">${lit?'✓':'○'} ${t.kind==='relay'?'РЕЛЕ':t.label==='ЗАМОК'?'ЗАМОК '+t.number:'СТАБ '+t.number}</span>`;}).join('');
 }
 function renderPuzzle() {
  el.droneEnergy.textContent=`${puzzle.energy} / ${puzzle.budget}`;
  el.droneEnergyBar.style.transform=`scaleX(${puzzle.energy/puzzle.budget})`;
  el.puzzleRetry.hidden=phase!=='failed';el.claimComponent.hidden=phase!=='reward';
  const power=powerPath(puzzle.board);
  el.puzzleStatusTitle.textContent=phase==='failed'?'ЭНЕРГИЯ ДРОНА ИСЧЕРПАНА':phase==='reward'?partName(getState().salvageReady?.part):phase==='flow'?'СИСТЕМЫ ВОССТАНОВЛЕНЫ':`ПИТАНИЕ: ${power.satisfied} / ${power.required.length} СИСТЕМ`;
  el.puzzleStatusText.textContent=phase==='failed'?'Объект сохранён. Повтор бесплатно.':phase==='reward'?'Найденная деталь → в гнездо двигателя':phase==='flow'?'Источник → сеть → обязательные системы':'Все отмеченные системы должны получать питание. Поворот = 1 энергия.';
  el.puzzleIntro.hidden=true; // Replaced by the contextual demo; no lecture above the board.
  el.puzzleScreen.dataset.phase=phase;updateBoard();
 }
 function startPuzzle() {
  if(tutorial.active)return;
  const state=getState(),job=currentJob(state);
  if(!state.orbitUnlocked||!job||recipeComplete(state)||state.vacuumEngineBuilt)return;
  tutorial.cancel();token++;jobId=job.id;puzzle=createPuzzle(job.template);phase=state.salvageReady?'reward':'playing';
  if(state.salvageReady){puzzle.board.forEach(tile=>tile.rotation=0);puzzle.status='success';}
  flowPath=[];flowProgress=0;setMode('puzzle');el.dockScreen.hidden=true;el.puzzleScreen.hidden=false;
  el.puzzleTitle.textContent=TEMPLATES[job.template].name;
  el.puzzleLesson.textContent=`ОБЪЕКТ ${Math.min(job.id,5)} / 5 · ${TEMPLATES[job.template].lesson}`;
  el.circuitBoard.replaceChildren();
  puzzle.board.forEach((tile,index)=>{
   const node=doc.createElement(tile.kind==='connector'?'button':'div');
   node.dataset.tile=index;
   if(tile.kind==='connector')node.type='button';
   else {node.setAttribute('role','img');node.setAttribute('aria-label',tile.kind==='source'?'ИСТОЧНИК ПИТАНИЯ':tile.kind==='target'?'ЦЕЛЕВОЙ ОТСЕК':'Выжженная ячейка');}
   el.circuitBoard.append(node);
  });
  renderPuzzle();doc.defaultView?.scrollTo({top:0,behavior:'instant'});el.puzzleBack.focus({preventScroll:true});
  if(phase==='playing')tutorial.begin(puzzle.board,jobId);
 }
 function rotate(index) {
  if(tutorial.active||!puzzle||phase!=='playing'||!rotateTile(puzzle,index))return false;
  if(!getState().puzzleIntroSeen){getState().puzzleIntroSeen=true;save();}
  el.circuitBoard.children[index].animate([{transform:'scale(.91)'},{transform:'scale(1)'}],{duration:reducedMotion?1:160});
  if(puzzle.status==='failed')phase='failed';
  if(puzzle.status==='success'){
   if(!prepareSalvageReward(getState(),jobId,puzzle)){dock();return;}
   save();phase='flow';flowPath=powerPath(puzzle.board).path;flowProgress=0;
   const sequence=++token,start=now();
   const tick=time=>{
    if(sequence!==token)return;
    const power=powerPath(puzzle.board),depth=Math.max(...flowPath.map(i=>power.depth.get(i)));
    flowProgress=Math.min(depth,Math.floor((time-start)/900*(depth+1)));updateBoard();
    if(time-start>=1200){phase='reward';renderPuzzle();el.claimComponent.focus({preventScroll:true});}
    else requestFrame(tick);
   };
   requestFrame(tick);
  }
  renderPuzzle();return true;
 }
 el.startSalvage.addEventListener('click',startPuzzle);
 el.circuitBoard.addEventListener('click',event=>{const button=event.target.closest('button[data-tile]');if(button){const index=Number(button.dataset.tile);if(tutorial.active)tutorial.acceptTap(index,()=>rotate(index));else rotate(index);}});
 el.puzzleRetry.addEventListener('click',()=>{if(tutorial.active||phase!=='failed')return;puzzle=retryPuzzle(puzzle);phase='playing';renderPuzzle();});
 el.claimComponent.addEventListener('click',()=>{if(tutorial.active||phase!=='reward')return;const part=claimSalvageReward(getState(),jobId);if(part){save();dock({arrivingPart:part});}});
 el.assembleEngine.addEventListener('click',()=>{if(!tutorial.active&&assembleEngine(getState())){save();dock({assembled:true});el.engineBlueprint.animate([{transform:'translateY(-3px)',filter:'brightness(1.6)'},{transform:'translateY(0)',filter:'brightness(1)'}],{duration:reducedMotion?1:1200});}});
 el.puzzleBack.addEventListener('click',()=>{if(!tutorial.active)dock();});
 el.dockBack.addEventListener('click',()=>{if(tutorial.active)return;token++;el.dockScreen.hidden=true;el.puzzleScreen.hidden=true;enterGarage();});
 return {dock,hide(){tutorial.cancel();token++;el.dockScreen.hidden=true;el.puzzleScreen.hidden=true;}};
}
