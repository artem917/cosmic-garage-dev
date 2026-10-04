import {
  UPGRADE_ORDER,
  UPGRADES,
  createInitialState,
  sanitizeState,
  upgradeCost,
  statsFor,
  createFlight, createCourse, seededRandom, stepFlight, flightResult, layerFor, nextMilestone, MILESTONES, clamp, progressFor, TUTORIAL_ORDER, TUTORIAL_COPY, completeTutorial, tutorialCandidate, cameraView, pointerControl, altitudeGauge, createControlTimeline, keyboardControl, objectX, damageState, hazardActive, ROUTE_END, altitudeKm, formatAltitude, speedKmh, maxLevel, protectionText, collisionCopy, armCollisionTutorial, acceptCollisionTutorial, resumeCollisionTutorial, environmentFor, resultGoal, recordFlight,
} from "./game-logic.js";
import {bindUpgradeFeedback,tooltipPosition} from './upgrade-feedback.js';
import {hazardSvg,HAZARD_NAMES} from './hazard-art.js';

const SAVE_KEY = "cosmic-garage-active-v2";
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const dom = Object.fromEntries(
  [
    "scrapValue", "bestValue", "launchCount", "garageStats", "flightHud", "distanceValue",
    "flightBestValue", "flightProgressBar", "eventToast", "eventTitle", "eventMessage", "eventResult",
    "garagePanel", "upgradeList", "launchButton", "launchEstimate", "resultCard", "resultKicker",
    "resultTitle", "resultDistance", "resultBreakdown", "resultReward", "collectButton", "resetButton",
    "locationLabel", "machineNote", "flightCaption", "upgradePop", "benchHint", "resultNext", "goalStatus", "routeMap", "fuelValue", "hullValue", "cargoValue", "objectLayer", "runClock", "goalDetail", "recordMarker", "recordBanner", "upgradeExplanation", "upgradeExplanationText", "upgradeExplanationTitle", "infoClose", "tutorialOverlay", "tutorialSpot", "tutorialBubble", "tutorialTitle", "tutorialText", "tutorialContinue", "tutorialSkip", "fuelHud", "fuelMeter", "fuelGain", "altitudeCapsule", "stageBanner", "hullHud", "speedValue", "tutorialClose", "collisionSuppress",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

window.dispatchEvent(new CustomEvent("cosmic-startup-stage", {detail:"ui"}));
let state = loadState();
const collisionSession={shown:false};
window.dispatchEvent(new CustomEvent("cosmic-startup-stage", {detail:"save"}));
let mode = "garage";
let launch = null;
let particles = [];
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
let lastFrame = performance.now();
const shell = document.querySelector(".game-shell");
shell.dataset.thumbTest=new URLSearchParams(location.search).get('devThumb')==='1';
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tallies = new Map();
let installation = null;
let resetArmedUntil = 0;
let targetX = .5;
let keyboardDirection = 0;
let keyboardActive=false;
let canvasBounds=null;
const heldKeys=new Set();
let pointerId = null;
let objectNodes = new Map();
const upgradeFeedback=bindUpgradeFeedback({list:dom.upgradeList,box:dom.upgradeExplanation,title:dom.upgradeExplanationTitle,text:dom.upgradeExplanationText,close:dom.infoClose,pop:dom.upgradePop,configs:UPGRADES,isGarage:()=>mode==='garage',position:positionInfo});

const PART_ICONS = {
  engine: '<path d="M9 12h18l-3 15H12z" fill="#dfb967"/><path d="M10 13H6v10h6m14-10h5v10h-6" stroke="#87b7ab" stroke-width="4"/><path d="M15 28l3 7 4-7" fill="#ff8c48"/><path d="M12 6h13v5H12z" fill="#bac7b5"/>',
  fuel: '<rect x="11" y="8" width="17" height="25" rx="5" fill="#d2844b"/><path d="M15 5h9v4h-9" fill="#c6d2bc"/><path d="M12 16h15m-15 9h15" stroke="#edc77b" stroke-width="3"/><path d="M27 12h4v15h-4" fill="none" stroke="#96c1ad" stroke-width="3"/>',
  hull: '<path d="m8 10 22-3 4 25-23 3z" fill="#b1c6b4"/><path d="m12 17 18-2m-16 9 17-2" stroke="#628b7f" stroke-width="3"/><circle cx="13" cy="13" r="2" fill="#e7bb61"/><circle cx="27" cy="28" r="2" fill="#e7bb61"/>',
  guidance: '<path d="M18 20v12m-7 1h18" stroke="#bec4a4" stroke-width="4"/><path d="M9 9q0 16 19 16z" fill="#d8bb70"/><path d="m20 16 7-8" stroke="#b9d3bc" stroke-width="3"/><circle cx="28" cy="7" r="3" fill="#82e9d8"/>',
  magnet: '<path d="M10 10v13a9 9 0 0 0 18 0V10" fill="none" stroke="#df7451" stroke-width="7"/><path d="M10 7v9m18-9v9" stroke="#c5d6c5" stroke-width="7"/><path d="m16 6 3-4 3 4" fill="none" stroke="#80e4d1" stroke-width="2"/>',
};

function setMode(next) {
  mode = next;
  shell.dataset.mode = next;
  resizeCanvas();
}

function tally(element, from, to, duration = 450, delay = 0) {
  tallies.delete(element);
  const token = {};
  tallies.set(element, token);
  const start = performance.now() + delay;
  element.textContent = Math.round(from);
  function tick(now) {
    if (tallies.get(element) !== token) return;
    const t = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - start) / duration));
    element.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(tick);
    else tallies.delete(element);
  }
  requestAnimationFrame(tick);
}

function walletFeedback(amount) {
  const wallet = document.querySelector(".wallet");
  wallet.classList.remove("gain", "spend");
  void wallet.offsetWidth;
  wallet.classList.add(amount > 0 ? "gain" : "spend");
  const delta = document.createElement("span");
  delta.className = `scrap-delta${amount < 0 ? " negative" : ""}`;
  delta.textContent = `${amount > 0 ? "+" : ""}${amount}`;
  shell.append(delta);
  setTimeout(() => delta.remove(), 950);
}

function nextEffect(key,level) {
 const before=statsFor({...state.upgrades,[key]:level}),after=statsFor({...state.upgrades,[key]:level+1});
 if(key==="engine")return `Подъём +${Math.round((after.climb/before.climb-1)*100)}% · на том же топливе`;
 if(key==="fuel")return `Топливо ${before.fuel.toFixed(1)} → ${after.fuel.toFixed(1)} с`;
 if(key==="hull")return level ? "3 защитные секции · модуль установлен" : "2 → 3 секции · ещё одна жизнь";
 if(key==="guidance")return `Отклик +${Math.round((after.response/before.response-1)*100)}% · снос ↓`;
 return `Захват ${Math.round(before.magnet*100)} → ${Math.round(after.magnet*100)}% ширины`;
}

function loadState() {
 try {
  const raw=JSON.parse(localStorage.getItem(SAVE_KEY)??localStorage.getItem("cosmic-garage-proof-v1")),migrated=sanitizeState(raw);
  if(raw&&raw.saveVersion!==5){try{localStorage.setItem(SAVE_KEY,JSON.stringify(migrated));}catch{/* Keep loaded progress even when storage is read-only. */}}
  return migrated;
 }
 catch{return createInitialState();}
}

function saveState() {
 try {localStorage.setItem(SAVE_KEY,JSON.stringify(state));}
 catch {dom.benchHint.textContent="Сохранение недоступно: прогресс только в этой вкладке";}
}

function renderGarageUi(purchasedKey = null) {
  updateGoal();
  tallies.delete(dom.scrapValue);
  dom.scrapValue.textContent = state.scrap;
  dom.bestValue.textContent = formatAltitude(state.bestAltitude);
  dom.launchCount.textContent = state.launches;
  dom.upgradeList.replaceChildren();

  for (const key of UPGRADE_ORDER) {
    const config = UPGRADES[key];
    const level = state.upgrades[key];
    const cost = upgradeCost(key, level);
    const card = document.createElement("article");
    const affordable = level<maxLevel(key)&&state.scrap >= cost;
    card.dataset.category = key;
    card.className = `upgrade-card${affordable ? " affordable" : ""}${key === purchasedKey ? " purchased" : ""}`;
    card.innerHTML = `
      <button class="upgrade-icon upgrade-info" type="button" data-info="${key}" aria-label="Зачем нужен ${config.name}" aria-expanded="false" aria-controls="upgradeExplanation">
       <svg viewBox="0 0 40 40" aria-hidden="true">${PART_ICONS[key]}</svg><small aria-hidden="true">?</small>
      </button>
      <div class="upgrade-copy">
        <div class="upgrade-title"><h3>${config.name}</h3><span class="upgrade-level">УР. ${level}</span></div>
        <p class="upgrade-effect">${nextEffect(key, level)}</p>
      </div>
      <button class="buy-button" type="button" data-upgrade="${key}"
        aria-label="${config.name}: улучшить за ${cost} лома"
        ${!affordable ? "disabled" : ""}>
        ${level>=maxLevel(key)?'МАКС':'◆ '+cost}<small>${level>=maxLevel(key)?'УСТАНОВЛЕНО':affordable ? "ПРИКРУТИТЬ" : "ЕЩЁ " + (cost - state.scrap)}</small>
      </button>`;
    dom.upgradeList.append(card);
  }

  const stats = statsFor(state.upgrades);
  dom.launchEstimate.textContent = `Рули только ↔ · топливо ${stats.fuel.toFixed(1)} с`;
  const available = UPGRADE_ORDER.filter((key) => state.upgrades[key]<maxLevel(key)&&state.scrap >= upgradeCost(key, state.upgrades[key]));
  dom.benchHint.classList.toggle("ready", available.length > 0);
  dom.benchHint.textContent = available.length
    ? `Хватит на новую деталь! Доступно: ${available.length}`
    : state.launches === 0 ? "Первый полёт — и хватит на новую деталь" : state.migrationRefund ? `Старый корпус: +${state.migrationRefund} лома за лишние уровни` : "Ещё один полёт — ещё немного лома";
}

function updateGoal(altitude=null) {
 const inFlight=mode==="launch";
 const p=progressFor(state.bestAltitude,inFlight?altitude??0:null);
 const liveBest=inFlight?Math.max(p.record,Math.floor(launch.run.peakAltitude)):p.record;
 const key=[mode,p.record,inFlight?p.nearby?.altitude:liveBest].join(":");
 if(dom.goalStatus.dataset.progressKey===key)return;
 dom.goalStatus.dataset.progressKey=key;
 if(inFlight){
  const nearby=p.nearby;
  setText(dom.goalStatus,nearby?`СЛЕДУЮЩИЙ РУБЕЖ: ${nearby.name.toUpperCase()} · ${nearby.km} км`:"ОРБИТА ДОСТИГНУТА");
  setText(dom.goalDetail,"ЦЕЛЬ: ОРБИТА 200 км · КОСМОС 100 км");
 }else{
  dom.goalStatus.textContent=`РЕКОРД: ${formatAltitude(p.record)} км · ${p.frontier.name.toUpperCase()}`;
  dom.goalDetail.textContent=p.next
   ?`${p.next.km} км: ещё ${(p.next.km-altitudeKm(p.record)).toFixed(1)} км · ОРБИТА: ещё ${(200-altitudeKm(p.record)).toFixed(1)} км`
   :"ОРБИТА 200 км ДОСТИГНУТА · НОВЫЕ ЗАПУСКИ С ЗЕМЛИ";
 }
 if(!inFlight)dom.routeMap.innerHTML=p.route.map(m=>`<span class="${m.status}" ${m.status==="current"?'aria-current="step"':""}>${m.status==="completed"?"✓":m.status==="current"?"●":"○"} ${m.km} км</span>`).join('<b>›</b>');
}
function setText(element,value){const text=String(value);if(element.textContent!==text)element.textContent=text;}
function hideInfo(){
 upgradeFeedback.hide();
}
function positionInfo(key){
 const viewport=window.visualViewport;
 const visible={left:viewport?.offsetLeft??0,top:viewport?.offsetTop??0,width:viewport?.width??innerWidth,height:viewport?.height??innerHeight};
 dom.upgradeExplanation.style.maxHeight=`${visible.height-16}px`;
 const anchor=dom.upgradeList.querySelector(`[data-info="${key}"]`).getBoundingClientRect();
 const bounds=shell.getBoundingClientRect();
 dom.upgradeExplanation.style.width=`${Math.min(bounds.width-28,visible.width-16)}px`;
 const p=tooltipPosition(anchor,bounds,dom.upgradeExplanation.getBoundingClientRect(),visible);
 Object.assign(dom.upgradeExplanation.style,{left:`${p.left}px`,top:`${p.top}px`,width:`${p.width}px`});
}
function positionTutorial(){
 if(!launch?.tutorial)return;
 const node=objectNodes.get(launch.tutorial.id),stage=canvas.getBoundingClientRect();
 if(!node&&launch.tutorial.type!=='collision')return;
 const rect=node?.getBoundingClientRect();
 const x=rect?rect.left-stage.left+rect.width/2:launch.run.x*canvasWidth,y=rect?rect.top-stage.top+rect.height/2:canvasHeight*.60;
 dom.tutorialSpot.style.left=`${x-42}px`;dom.tutorialSpot.style.top=`${y-45}px`;
 dom.tutorialBubble.style.top=`${Math.max(100,Math.min(y+55,canvasHeight-dom.tutorialBubble.offsetHeight-14))}px`;
 launch.tutorialLayout=`${canvasWidth}:${canvasHeight}`;
}
function showTutorial(object){
 launch.tutorial=object;launch.run.paused=true;launch.run.accumulator=0;
 shell.dataset.paused="true";keyboardDirection=0;heldKeys.clear();keyboardActive=false;
 if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
 pointerId=null;
 const collision=object.type==='collision';
 dom.tutorialOverlay.dataset.collision=collision;
 dom.tutorialClose.hidden=!collision;dom.collisionSuppress.hidden=!collision;
 dom.tutorialContinue.hidden=collision;dom.tutorialSkip.hidden=collision;
 dom.tutorialTitle.textContent=collision?"ЗАЩИТНАЯ СЕКЦИЯ ПОТЕРЯНА":TUTORIAL_COPY[object.type].title;
 dom.tutorialText.textContent=collision?collisionCopy(launch.run):TUTORIAL_COPY[object.type].text;
 dom.tutorialOverlay.hidden=false;positionTutorial();
 (collision?dom.tutorialClose:dom.tutorialContinue).focus({preventScroll:true});
}
function dismissTutorial(skip=false){
 if(!launch?.tutorial)return;
 if(launch.tutorial.type==='collision')resumeCollisionTutorial(launch.run,state,skip);
 else completeTutorial(state,skip?"skip":launch.tutorial.type);
 saveState();
 launch.lastTutorialChunk=launch.tutorial.chunk??0;
 launch.tutorialCooldown=launch.run.time+1.5;
 launch.tutorial=null;launch.run.paused=false;launch.run.accumulator=0;
 shell.dataset.paused="false";dom.tutorialOverlay.hidden=true;
 keyboardDirection=0;targetX=launch.run.x;launch.run.targetX=targetX;heldKeys.clear();lastFrame=performance.now();
 launch.controls.reset({x:targetX});
 canvas.focus({preventScroll:true});
}
function makeObjectNode(o){
 const node=document.createElement("div");
 node.className="flight-object "+o.type;node.dataset.type=o.type;node.dataset.chunk=o.chunk??0;
 node.setAttribute("role","img");
 node.setAttribute("aria-label",o.type==='hazard'?`${HAZARD_NAMES[o.skin]} · опасность: −1 защитная секция`:({fuel:"Топливо +6 с",scrap:"Лом +1",salvage:"Ценный лом +4"})[o.type]);
 node.innerHTML=o.type==='hazard'?hazardSvg(o.skin):({fuel:'<i>▰</i><small>+6 с</small>',scrap:'<i>◆</i><small>+1</small>',salvage:'<i>▣</i><small>+4</small>'})[o.type];
 if(o.width){node.classList.add('thematic-hazard');node.dataset.skin=o.skin;node.dataset.impact=o.impact;node.style.width=`${o.width*100}%`;}
 node.hidden=true;dom.objectLayer.append(node);objectNodes.set(o.id,node);return node;
}

function buyUpgrade(key) {
  if (mode !== "garage" || !UPGRADES[key] || state.upgrades[key]>=maxLevel(key)) return;
  hideInfo();
  const cost = upgradeCost(key, state.upgrades[key]);
  if (state.scrap < cost) return;
  const before = state.scrap;
  state.scrap -= cost;
  state.upgrades[key] += 1;
  saveState();
  installation = { key, start: performance.now() };
  upgradeFeedback.purchase(key,state.upgrades[key],({engine:'Тяга выросла',fuel:'Топлива больше',hull:'Теперь 3 защитные секции',guidance:'Отклик быстрее',magnet:'Захват шире'})[key]);
  burst(canvasWidth * 0.5, canvasHeight * 0.55, 28, "#ffe39a", 3.5);
  renderGarageUi(key);
  tally(dom.scrapValue, before, state.scrap, 280);
  walletFeedback(-cost);
  dom.machineNote.textContent = "Вот теперь почти как новая";
  dom.upgradeList.querySelector(`[data-upgrade="${key}"]`)?.focus();
}

function startLaunch(){
 if(mode!=="garage")return;
 hideInfo();
 const rawSeed=new URLSearchParams(location.search).get("seed");
 const rng=rawSeed!==null&&Number.isFinite(Number(rawSeed))?seededRandom(Number(rawSeed)):Math.random;
 launch={run:createFlight(state.upgrades,createCourse(rng,statsFor(state.upgrades))),plan:null,
  oldBest:state.bestAltitude,recordShown:false,recordUntil:0,start:performance.now(),resultStart:0,
  impactDone:false,quality:"mediocre",feedbackUntil:0,accumulator:0,tutorial:null,tutorialCooldown:0,lastTutorialChunk:-1,controls:createControlTimeline()};
 armCollisionTutorial(launch.run,state,collisionSession);
 targetX=.5;keyboardDirection=0;keyboardActive=false;heldKeys.clear();objectNodes=new Map();dom.objectLayer.replaceChildren();
 setMode("launch");particles=[];shell.dataset.paused="false";
 dom.garagePanel.hidden=true;dom.garageStats.hidden=true;dom.flightHud.hidden=false;
 dom.resultCard.hidden=true;dom.eventToast.hidden=true;dom.objectLayer.hidden=false;
 dom.tutorialOverlay.hidden=true;dom.recordBanner.hidden=true;
 dom.recordMarker.hidden=launch.oldBest<=0;
 dom.recordMarker.style.bottom=`${altitudeKm(launch.oldBest)/2}%`;
 dom.recordMarker.setAttribute("aria-label",`Предыдущий рекорд ${formatAltitude(launch.oldBest)} км`);
 dom.launchButton.disabled=true;dom.machineNote.hidden=true;dom.upgradePop.hidden=true;
 dom.fuelGain.hidden=true;
 dom.stageBanner.hidden=true;launch.stage=0;launch.stageUntil=0;
 dom.flightCaption.hidden=false;dom.flightCaption.textContent="РУЛИ ↔ · ПОДЪЁМ АВТОМАТИЧЕСКИЙ";
 canvas.focus({preventScroll:true});lastFrame=performance.now();updateGoal(0);drawLaunch(lastFrame,0);
}

function finishLaunch() {
 if(mode!=="launch")return;
 launch.plan=flightResult(launch.run,state.launches,state.claimedMilestones,state.orbitBonusClaimed);
 const p=launch.plan;
 launch.quality=p.reason==="orbit"?"exceptional":p.distance>launch.oldBest?"good":"mediocre";
 recordFlight(state,p);saveState();
 setMode("result");launch.resultStart=performance.now();
 dom.locationLabel.textContent=layerFor(p.distance).name.toUpperCase()+" · РЕЗУЛЬТАТ";
 dom.flightHud.hidden=true;dom.objectLayer.hidden=true;dom.eventToast.hidden=true;
 dom.tutorialOverlay.hidden=true;dom.recordBanner.hidden=true;dom.stageBanner.hidden=true;
 dom.resultKicker.textContent=p.distance>launch.oldBest?"НОВЫЙ РЕКОРД!":"РЕЗУЛЬТАТ ПОЛЁТА";
 dom.resultCard.dataset.quality=launch.quality;
 dom.resultTitle.textContent=p.landingLabel;
 dom.resultDistance.textContent=formatAltitude(p.distance);tally(dom.resultReward,0,p.reward,300);
 dom.resultBreakdown.innerHTML=`
 <div class="result-line"><span>Рекорд · время</span><strong>${formatAltitude(state.bestAltitude)} км · ${p.duration.toFixed(1)} с</strong></div>
 <div class="result-line"><span>Полёт / груз</span><strong>${p.base} / ${p.cargo} лома</strong></div>
 <div class="result-line"><span>Новые рубежи / первая Орбита</span><strong>${p.milestoneBonus} / ${p.orbitBonus} лома</strong></div>
 <div class="result-line"><span>Ценный лом · канистры · удары</span><strong>${p.salvage} · ${p.fuelPickups} · ${p.hits}</strong></div>
 ${p.firstFlightBonus?'<div class="result-line"><span>На первую деталь</span><strong>+'+p.firstFlightBonus+' лома</strong></div>':""}`;
 dom.resultNext.textContent=resultGoal(p.distance);
 dom.resultCard.hidden=false;dom.flightCaption.hidden=true;
 updateGoal(p.distance);dom.collectButton.focus({preventScroll:true});
}

function collectReward() {
  if (mode !== "result") return;
  const plan = launch.plan;
  const before = state.scrap;
  const source = dom.resultReward.getBoundingClientRect();
  state.scrap += plan.reward;
  state.launches += 1;
  state.claimedMilestones=[...new Set([...state.claimedMilestones,...plan.milestones])];
  if(plan.orbitBonus)state.orbitBonusClaimed=true;
  state.bestAltitude = Math.max(state.bestAltitude, plan.distance);
  saveState();
  setMode("garage");
  launch = null;
  particles = [];
  dom.resultCard.hidden = true;
  dom.garagePanel.hidden = false;
  dom.garageStats.hidden = false;
  dom.launchButton.disabled = false;
  dom.locationLabel.textContent = "ГАРАЖ · ОТСЕК 07";
  dom.machineNote.hidden = false;
  dom.machineNote.textContent = "Выше — к орбите. Прикрутим новую деталь?";
  renderGarageUi();
  tally(dom.scrapValue, before, state.scrap, 550);
  walletFeedback(plan.reward);
  flyScrapToWallet(source);
  dom.launchButton.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function flyScrapToWallet(source) {
  if (reducedMotion) return;
  const destination = dom.scrapValue.getBoundingClientRect();
  const bounds = shell.getBoundingClientRect();
  for (let i = 0; i < 9; i += 1) {
    const scrap = document.createElement("span");
    scrap.className = "flying-scrap";
    scrap.textContent = "◆";
    scrap.style.left = `${source.left - bounds.left + source.width * 0.5}px`;
    scrap.style.top = `${Math.min(source.top - bounds.top, shell.clientHeight - 50)}px`;
    shell.append(scrap);
    const dx = destination.left - source.left;
    const dy = destination.top - Math.min(source.top, bounds.top + shell.clientHeight - 50);
    scrap.animate([
      { transform: "translate(0, 0) scale(.8)", opacity: 0 },
      { transform: `translate(${(i - 4) * 15}px, -35px) scale(1)`, opacity: 1, offset: .2 },
      { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
    ], { duration: 620, delay: i * 25, easing: "ease-in" }).finished.then(() => scrap.remove());
  }
}

function resetGame() {
  if (performance.now() > resetArmedUntil) {
    resetArmedUntil = performance.now() + 4000;
    dom.resetButton.textContent = "СБРОСИТЬ?";
    dom.resetButton.setAttribute("aria-label", "Подтвердить сброс прогресса");
    setTimeout(() => {
      if (performance.now() >= resetArmedUntil) {
        dom.resetButton.textContent = "DEV RESET";
        dom.resetButton.removeAttribute("aria-label");
      }
    }, 4100);
    return;
  }
  resetArmedUntil = 0;
  dom.resetButton.textContent = "DEV RESET";
  dom.resetButton.removeAttribute("aria-label");
  state = createInitialState();collisionSession.shown=false;
  hideInfo();dom.tutorialOverlay.hidden=true;dom.recordBanner.hidden=true;dom.stageBanner.hidden=true;shell.dataset.paused="false";
  dom.objectLayer.hidden=true;
  targetX=.5;keyboardDirection=0;
  tallies.clear();
  installation = null;
  saveState();
  setMode("garage");
  launch = null;
  particles = [];
  dom.resultCard.hidden = true;
  dom.garagePanel.hidden = false;
  dom.garageStats.hidden = false;
  dom.flightHud.hidden = true;
  dom.eventToast.hidden = true;
  dom.locationLabel.textContent = "ГАРАЖ · ОТСЕК 07";
  dom.machineNote.hidden = false;
  dom.machineNote.textContent = "Собрано из того, что не жалко";
  dom.flightCaption.hidden = true;
  dom.upgradePop.hidden = true;
  dom.launchButton.disabled = false;
  renderGarageUi();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvasBounds=rect;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if(launch)launch.tutorialLayout=null;
}

function burst(x, y, count, color, power) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.5 + Math.random()) * power;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.7,
      maxLife: 1.2,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.x += particle.vx * dt * 60;
    particle.y += particle.vy * dt * 60;
    particle.vy += 0.045 * dt * 60;
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  ctx.save();
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Presentation only: every outcome and resource value still comes from game-logic.js.
function plate(x, y, w, h, color, radius = 5) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#183332";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

function path(points, color, stroke = "#183332", width = 3) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function bolt(x, y, radius = 2.4) {
  ctx.fillStyle = "#314741";
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d5c89b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 1, y - 1); ctx.lineTo(x + 1, y); ctx.stroke();
}

function drawGarage(now, ignition = 0) {
  const w = canvasWidth, h = canvasHeight;
  ctx.save();
  ctx.scale(w / 390, h / 350);
  const wall = ctx.createLinearGradient(0, 0, 0, 350);
  wall.addColorStop(0, "#263f3e");
  wall.addColorStop(.7, "#527065");
  wall.addColorStop(1, "#203f3a");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 390, 350);

  // Recessed door and side walls make the rocket occupy a room, not a card.
  plate(74, 17, 246, 278, "#1f3d3d", 35);
  plate(85, 23, 223, 265, "#50736a", 28);
  for (let y = 55; y < 281; y += 31) {
    ctx.fillStyle = "#2e534c"; ctx.fillRect(88, y, 217, 5);
    ctx.fillStyle = "#73907a"; ctx.fillRect(88, y + 5, 217, 1);
  }
  for (let y = 70; y < 280; y += 60) { bolt(79, y, 3); bolt(314, y, 3); }
  ctx.fillStyle = "#9caf82"; ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("07", 180, 83);
  ctx.globalAlpha = .2;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = i % 3 ? "#a5be8c" : "#111f1d";
    ctx.fillRect((i * 89) % 390, 30 + (i * 37) % 250, 1 + i % 4, 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#15332f"; ctx.fillRect(0, 293, 390, 57);
  path([[0, 295], [390, 295], [390, 350], [0, 350]], "#28493c");
  ctx.strokeStyle = "#3f5d47"; ctx.lineWidth = 2;
  for (let i = -3; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(195 + i * 40, 294); ctx.lineTo(195 + i * 80, 350); ctx.stroke();
  }
  // Launch pad: heavy metal ring with worn hazard markings.
  ctx.fillStyle = "#152f2f";
  ctx.beginPath(); ctx.ellipse(197, 301, 89, 19, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#849270"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(197, 297, 76, 13, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#d2b269"; ctx.lineWidth = 8;
  ctx.setLineDash([12, 14]);
  ctx.beginPath(); ctx.ellipse(197, 297, 76, 13, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  drawWorkshopProps(390, 350, now);
  ctx.restore();
  const scale = Math.min(w / 390, h / 330) * 1.32;
  const reaction = installation ? Math.max(0, 1 - (now - installation.start) / 700) : 0;
  const jiggle = reducedMotion ? 0 : Math.sin(now * .045) * reaction * .045;
  const startupShake = !reducedMotion && ignition ? Math.sin(now * .09) * ignition * 2 : 0;
  drawFloorGlow(w * .5, h * .87, 90 + ignition * 25);
  drawRocket(w * .51 + startupShake, h * .57, scale, jiggle, ignition * .7, state.upgrades, now);
  if (reaction > 0) {
    ctx.save(); ctx.globalAlpha = reaction;
    ctx.strokeStyle = "#fff0a0"; ctx.lineWidth = 2;
    const anchors = {engine: [0, 65], fuel: [-44, -5], hull: [5, 0], guidance: [36, -70], magnet: [45, 42]};
    const [ax, ay] = anchors[installation.key];
    ctx.beginPath(); ctx.arc(w * .51 + ax * scale, h * .57 + ay * scale, 27 + (1 - reaction) * 23, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  drawParticles();
}

function drawWorkshopProps(w, h, now) {
  ctx.save();
  // Looped cables and swinging amber task lamps.
  for (const side of [0, 1]) {
    const x = side ? 340 : 47;
    ctx.strokeStyle = "#122e30"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, -10);
    ctx.bezierCurveTo(x + 32, 80, x - 20, 85, x + 13, 150); ctx.stroke();
    ctx.strokeStyle = "#6f8166"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 1, 0); ctx.quadraticCurveTo(x + 15, 64, x - 3, 115); ctx.stroke();
    const lampX = x + (side ? -13 : 18), lampY = side ? 94 : 81;
    ctx.save(); ctx.translate(lampX, lampY);
    ctx.rotate(reducedMotion ? 0 : Math.sin(now * .0008 + side) * .025);
    const light = ctx.createRadialGradient(0, 20, 5, 0, 40, 140);
    light.addColorStop(0, "#ffe5a44c"); light.addColorStop(1, "#ffe5a400");
    ctx.fillStyle = light; ctx.fillRect(-145, 0, 290, 270);
    path([[-18, 0], [-10, -12], [10, -12], [18, 0]], "#8b8e64");
    plate(-17, 0, 34, 6, "#ffe6a2", 3);
    ctx.restore();
  }

  // Tools, a spare exhaust, nuts, taped cabinet and a not-quite-safe electrical box.
  plate(6, 151, 57, 117, "#294b48");
  ctx.fillStyle = "#5a7970"; ctx.fillRect(11, 169, 46, 3); ctx.fillRect(11, 218, 46, 3);
  plate(13, 231, 41, 25, "#c2a672", 2);
  ctx.strokeStyle = "#a9b799"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(21, 159); ctx.lineTo(27, 195); ctx.stroke();
  ctx.beginPath(); ctx.arc(21, 155, 6, .3, Math.PI * 1.8); ctx.stroke();
  plate(36, 182, 14, 24, "#8c7158", 2);
  bolt(40, 192, 3);
  plate(328, 174, 50, 74, "#6a7560");
  plate(336, 182, 33, 22, "#102f30", 2);
  ctx.fillStyle = "#95dbc3"; ctx.fillRect(341, 188, 4, 5); ctx.fillRect(349, 188, 13, 2);
  path([[348, 211], [341, 222], [348, 222], [344, 233], [357, 217], [350, 217]], "#e6c97c", null);
  bolt(333, 177); bolt(373, 177);
  ctx.strokeStyle = "#2b3630"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(351, 247); ctx.bezierCurveTo(366, 280, 285, 292, 270, 311); ctx.stroke();

  // Foreground clutter stays at the edges, leaving the machine silhouette readable.
  plate(-9, 288, 73, 44, "#7b7660", 2);
  ctx.strokeStyle = "#d4b473"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 302); ctx.lineTo(50, 312); ctx.stroke();
  path([[330, 300], [377, 288], [395, 324], [344, 330]], "#375c52");
  plate(339, 282, 26, 30, "#b08254", 3);
  ctx.fillStyle = "#59716b"; ctx.beginPath(); ctx.arc(322, 318, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#193b38"; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = "#193b38"; ctx.beginPath(); ctx.arc(322, 318, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a5b994"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(43, 300); ctx.lineTo(80, 282); ctx.stroke();
  ctx.fillStyle = "#d3b778"; ctx.fillRect(47, 278, 12, 13);
  if (!reducedMotion) {
    const flicker = Math.sin(now * .005) > .97;
    ctx.fillStyle = flicker ? "#ffe696" : "#bfc079";
    ctx.fillRect(371, 239, 4, 3);
    if (flicker) {
      ctx.strokeStyle = "#ffe9a4"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(375, 239); ctx.lineTo(382, 235); ctx.lineTo(381, 242); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFloorGlow(x, y, radius) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, "#ffe08a40"); glow.addColorStop(1, "#ffe08a00");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .18, 0, 0, Math.PI * 2); ctx.fill();
}

function drawLaunch(now,dt) {
 const r=launch.run;
 if(document.hidden)return;
 const activeDt=r.paused?0:dt;
 const cosmeticDt=Math.min(dt,.05);
 stepFlight(r,activeDt,run=>launch.controls.sample(run.time));
 if(keyboardActive)targetX=r.targetX;
 const layer=layerFor(r.altitude);
 setText(dom.locationLabel,layer.name.toUpperCase()+" · ПОЛЁТ");
 const stage=MILESTONES.indexOf(layer);
 if(stage>launch.stage){
  launch.stage=stage;launch.stageUntil=r.time+1;
  const first=layer.altitude>launch.oldBest;
  dom.stageBanner.innerHTML=`<strong>${layer.km===100?'100 КМ · КОСМОС':layer.name.toUpperCase()}</strong><small>${layer.km===100?'ЛИНИЯ КАРМАНА ПРОЙДЕНА':layer.km+' КМ · '+(first?'НОВЫЙ РУБЕЖ':'ЭТАП '+(stage+1))}</small>`;
  dom.stageBanner.dataset.first=first;
  burst(canvasWidth*.5,canvasHeight*.23,first?35:18,'#b7f6e1',2.2);
 }
 dom.stageBanner.hidden=r.time>=launch.stageUntil;
 const damage=damageState(r);dom.hullHud.dataset.damage=damage;
 setText(dom.distanceValue,formatAltitude(r.altitude));
 setText(dom.speedValue,speedKmh(r).toLocaleString("ru-RU"));
 setText(dom.flightBestValue,formatAltitude(Math.max(launch.oldBest,r.peakAltitude)));
 setText(dom.fuelValue,r.fuel.toFixed(1));
 setText(dom.hullValue,protectionText(r));
 dom.hullHud.setAttribute("aria-label",`Осталось ${r.sections} из ${r.stats.sections} защитных секций`);
 setText(dom.cargoValue,r.cargo);
 setText(dom.runClock,r.time.toFixed(1));
 dom.flightProgressBar.style.transform=`scaleY(${altitudeGauge(r.altitude,launch.oldBest).fill})`;
 dom.altitudeCapsule.setAttribute("aria-valuenow",altitudeKm(r.altitude).toFixed(1));
 dom.fuelMeter.style.transform=`scaleX(${r.fuel/Math.max(r.stats.fuel,r.fuel)})`;
 dom.fuelValue.parentElement.classList.toggle("low",r.fuel<5);
 updateGoal(r.altitude);
 const view=cameraView(r,canvasHeight),rocketY=view.rocketY,scale=view.scale;
 // Render only the activated immediate chunk; future chunks stay data-only.
 drawSky(r.altitude/ROUTE_END,r.time*2660,98+Math.min(4,stage)*14);
 drawLayerScenery(environmentFor(r.altitude),r.cameraAltitude/28,now);
 const impactAge=(now-(launch.impactWall??-10000))/1000;
 const impactStrength=({light:2,serious:6,heavy:11})[r.lastImpact?.impact]??0;
 const shake=reducedMotion?0:Math.sin(now*.09)*impactStrength*Math.max(0,1-impactAge/.55);
 if(r.time<launch.stageUntil){ctx.fillStyle=`rgba(191,245,225,${.12*(launch.stageUntil-r.time)})`;ctx.fillRect(0,0,canvasWidth,canvasHeight);}
 for(const o of r.objects){
  if(!o.active||o.type==='route')continue;
  const node=objectNodes.get(o.id)??makeObjectNode(o),y=view.worldY(o.altitude);
  node.hidden=o.done||y<95||y>canvasHeight;
  if(!node.hidden){
   node.style.left=`${objectX(o,r)*100}%`;node.style.transform=`translate(-50%,calc(${y}px - 50%))`;
   if(o.type==='hazard'){node.style.height=`${view.flow*.24}px`;node.dataset.active=hazardActive(o,r);}
  }
 }
 const rocketX=r.x*canvasWidth;
 ctx.save();ctx.translate(shake,0);
 if(state.upgrades.magnet>0){
  ctx.strokeStyle="#92efca88";ctx.setLineDash([4,6]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(rocketX,rocketY,r.stats.magnet*canvasWidth,12*scale,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 }
 drawRocket(rocketX,rocketY,Math.min(.64,canvasWidth/570),clamp(r.vx*.19,-.2,.2),r.slow>0?.4:.8,state.upgrades,now);
 if(damage){
  ctx.fillStyle="#313832aa";ctx.beginPath();ctx.ellipse(rocketX-8,rocketY,12,7,.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#613e33';ctx.lineWidth=damage+1;ctx.beginPath();ctx.moveTo(rocketX-9,rocketY-15);ctx.lineTo(rocketX+7,rocketY-2);ctx.lineTo(rocketX-6,rocketY+10);ctx.stroke();
  if(Math.random()<cosmeticDt*[0,4,22,40][damage]){particles.push({x:rocketX,y:rocketY+36,vx:Math.random()-.5,vy:2,life:.65,maxLife:.65,size:4+damage*2,color:damage===3?'#392d2e':'#424b48'});}
 }
 ctx.restore();
 for(const event of r.events.splice(0)){
  if(event.type==='hazard')launch.impactWall=now;
  const count=event.type==='hazard'?({light:10,serious:30,heavy:52})[event.impact]:14;
  burst(event.x*canvasWidth,view.worldY(event.altitude),count,event.type==="hazard"?"#ff9769":event.type==="fuel"?"#94f4de":"#ffda77",event.impact==='heavy'?5:3);
  if(event.type==='hazard')dom.hullHud.animate([{transform:`scale(${event.impact==='heavy'?1.22:1.12})`,backgroundColor:'#ff7355'},{transform:'scale(1)',backgroundColor:'transparent'}],{duration:event.impact==='light'?250:550});
  if(event.type==="fuel"){
   dom.fuelGain.textContent=`+${event.gain.toFixed(1)} с`;dom.fuelGain.hidden=false;launch.fuelFeedbackUntil=now+1400;
   dom.fuelHud.getAnimations().forEach(a=>a.cancel());
   dom.fuelHud.animate([{backgroundColor:"#97f4c9",color:"#153d34",transform:"scale(1.07)"},{backgroundColor:"#133a36",color:"#a1f4d8",transform:"scale(1)"}],{duration:1000});
   dom.fuelGain.getAnimations().forEach(a=>a.cancel());
   dom.fuelGain.animate([{opacity:1,transform:"translateY(0)"},{opacity:1,transform:"translateY(-7px)",offset:.75},{opacity:0,transform:"translateY(-12px)"}],{duration:1400});
   // Animate the meter upward, then let the authoritative value continue its normal burn.
   const denominator=Math.max(r.stats.fuel,event.after);
   dom.fuelMeter.animate([{transform:`scaleX(${event.before/denominator})`},{transform:`scaleX(${event.after/denominator})`}],{duration:260});
  }
  dom.eventTitle.textContent=event.type==="hazard"?(damageState(r)===3?"ПОСЛЕДНЯЯ СЕКЦИЯ":event.impact==='heavy'?"ТЯЖЁЛЫЙ УДАР":"УДАР — ВЫРУЛИВАЙ"):"ПОДОБРАНО";
  dom.eventMessage.textContent=event.text;dom.eventResult.textContent="";
  dom.eventToast.dataset.impact=event.type==="hazard"?"hit":"clear";
  dom.eventToast.hidden=false;launch.feedbackUntil=now+1250;
 }
 if(now>launch.feedbackUntil)dom.eventToast.hidden=true;
 if(now>(launch.fuelFeedbackUntil??0))dom.fuelGain.hidden=true;
 if(!launch.recordShown&&r.altitude>=Math.max(25,launch.oldBest+1)){
  launch.recordShown=true;launch.recordUntil=r.time+2;dom.recordBanner.textContent="НОВЫЙ РЕКОРД!";
 }
 dom.recordBanner.hidden=r.time>launch.recordUntil||!launch.recordShown;
 setText(dom.flightCaption,`${damage===3?'ПОСЛЕДНИЙ ШАНС · ':''}${r.fuel<10?"ИЩИ ТОПЛИВО":"ИЩИ ПРОХОД · РУЛИ ↔"}`);
 if(acceptCollisionTutorial(r,collisionSession))showTutorial({type:"collision",chunk:-1});
 if(!r.paused&&!r.ended&&r.time>=launch.tutorialCooldown){
  const visibleRun={...r,objects:r.objects.filter(o=>objectNodes.has(o.id)&&!objectNodes.get(o.id).hidden)};
  const candidate=tutorialCandidate(visibleRun,state.tutorials,launch.lastTutorialChunk);
  if(candidate&&objectNodes.get(candidate.id)&&!objectNodes.get(candidate.id).hidden)showTutorial(candidate);
 }
 if(r.paused&&launch.tutorialLayout!==`${canvasWidth}:${canvasHeight}`)positionTutorial();
 updateParticles(r.paused?cosmeticDt:activeDt);drawParticles();
 if(r.ended)finishLaunch();
}

function drawSky(altitude, elapsed, speed) {
  const w = canvasWidth, h = canvasHeight;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mixColor([71, 146, 157], [15, 27, 60], altitude));
  sky.addColorStop(1, mixColor([219, 204, 151], [67, 99, 124], altitude));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * .78, h * .27, 4, w * .78, h * .27, 125);
  sun.addColorStop(0, "#ffdc9b55"); sun.addColorStop(1, "#ffdc9b00");
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efd59a"; ctx.globalAlpha = .65;
  ctx.beginPath(); ctx.arc(w * .78, h * (.27 + altitude * .28), 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Clouds move at three different depths, then fall away as the sky darkens.
  for (let layer = 0; layer < 3; layer++) {
    ctx.globalAlpha = Math.max(0, 1 - altitude * 1.6) * (.13 + layer * .13);
    for (let i = 0; i < 3; i++) {
      const x = ((i * 137 + layer * 47) % (w + 90)) - 45;
      const y = ((i * 201 + layer * 113 + elapsed * (.022 + layer * .045)) % (h + 130)) - 65;
      ctx.fillStyle = "#fff5cb";
      ctx.beginPath();
      ctx.ellipse(x, y, 49 + layer * 12, 15 + layer * 6, -.12, 0, Math.PI * 2);
      ctx.ellipse(x + 24, y - 9, 25, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  drawSpeedField(altitude, elapsed, speed);
}

function drawSpeedField(altitude, elapsed, speed) {
  const w = canvasWidth, h = canvasHeight;
  ctx.save();
  for (let i = 0; i < 45; i++) {
    const x = (i * 97.3) % w;
    const pace = (.035 + i % 7 * .015) * (1 + speed / 70);
    const y = ((i * 71 + elapsed * pace) % (h + 50)) - 25;
    ctx.globalAlpha = i % 3 ? .25 + altitude * .5 : .14;
    ctx.strokeStyle = i % 5 === 0 ? "#a1edd5" : "#fff4d2";
    ctx.lineWidth = i % 6 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 2 + speed * .28); ctx.stroke();
  }
  ctx.restore();
}

function drawLayerScenery(layer,time,now) {
 const w=canvasWidth,h=canvasHeight;
 ctx.save();
 if(layer==="city"){
  ctx.fillStyle="#3b615277";
  for(let i=0;i<7;i++){
   const y=(i*137+time*19)%(h+220)-110;
   ctx.fillRect(i%2?w-26:0,y,26,90+i%3*23);
   ctx.fillStyle="#ffe09a44";ctx.fillRect(i%2?w-19:7,y+13,6,8);ctx.fillStyle="#274c6277";
  }
 }else if(layer==="cloud"){
  ctx.fillStyle="#f2f3e324";
  for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(i%2?w:0,(i*190+time*30)%(h+140)-70,95,30,0,0,Math.PI*2);ctx.fill();}
 }else if(layer==="storm"){
  ctx.fillStyle="#293b5977";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#a7ced84d";ctx.lineWidth=1;
  for(let i=0;i<25;i++){const x=(i*67+Math.sin(time)*20)%w,y=(i*51+time*130)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+22);ctx.stroke();}
  // Distant decorative lightning at edges only: not an additional hazard.
  if(!reducedMotion&&Math.sin(now*.003)>.97){path([[w-15,160],[w-34,199],[w-22,194],[w-39,232]],"#d5f3dc",null);}
 }else{
  ctx.fillStyle="#dcf2e2aa";for(let i=0;i<18;i++){ctx.fillRect((i*71)%w,(i*47+time*8)%h,2,2);}
  ctx.strokeStyle="#92d9ce88";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(w*.5,h*.93,w*.8,32,0,Math.PI,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}

function drawFlightEnd(now, t = 1) {
  const w = canvasWidth, h = canvasHeight;
  if(launch.plan.reason==="orbit"){
    drawSky(1,now-launch.resultStart,0);
    const sheetTop=dom.resultCard.getBoundingClientRect().top-canvas.getBoundingClientRect().top;
    const y=Math.max(85,Math.min(h*.24,sheetTop-90));
    ctx.fillStyle="#4e9f9588";ctx.beginPath();ctx.ellipse(w*.5,h*1.16,w*.9,h*.4,0,0,Math.PI*2);ctx.fill();
    drawRocket(w*.5,y+(reducedMotion?0:Math.sin(now*.002)*4),.58,-.1,.12,state.upgrades,now);
    return;
  }
  const reframe = mode === "result" ? Math.min(1, Math.max(0, (now - launch.resultStart) / 300)) : 0;
  // Keep the wreck / standing rocket above the reward sheet even on short phones.
  const resultTop = dom.resultCard.offsetTop - canvas.parentElement.offsetTop;
  const targetGround = Math.min(h * .39, Math.max(95, resultTop - 35));
  const ground = h * .78 + (targetGround - h * .78) * (1 - (1 - reframe) ** 3);
  const plan = launch.plan;
  const impactT = .58;
  const impactAge = Math.max(0, (t - impactT) / (1 - impactT));
  const shake = reducedMotion ? 0 : Math.max(0, 1 - impactAge * 2) * (t >= impactT ? 8 : 0);
  ctx.save(); ctx.translate(Math.sin(now * .11) * shake, Math.cos(now * .08) * shake * .5);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#19334d"); sky.addColorStop(1, "#678a8a");
  ctx.fillStyle = sky; ctx.fillRect(-10, -10, w + 20, h + 20);
  ctx.fillStyle = "#f4d490"; ctx.beginPath(); ctx.arc(w * .8, h * .18, 25, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = "#d9dba7"; ctx.fillRect((i * 83) % w, (i * 53) % (h * .5), 2, 2);
  }
  path([[-10, ground + 10], [w * .1, ground - 22], [w * .27, ground + 2], [w * .5, ground - 10], [w * .76, ground - 35], [w + 10, ground], [w + 10, h + 10], [-10, h + 10]], "#76998b", null);
  path([[-10, ground + 25], [w * .23, ground + 6], [w * .6, ground + 20], [w + 10, ground + 8], [w + 10, h + 10], [-10, h + 10]], "#456b61", null);
  ctx.fillStyle = "#34574f"; ctx.beginPath(); ctx.ellipse(w * .5, ground + 9, 70, 14, 0, 0, Math.PI * 2); ctx.fill();
  const flightScale = Math.min(w / 390, h / 650) * 1.15;
  const resultScale = Math.min(flightScale, Math.max(.5, (targetGround - 25) / 170));
  const rocketScale = flightScale + (resultScale - flightScale) * reframe;
  const touchdownY = ground - 74 * rocketScale;
  const descent = Math.min(1, t / impactT);
  const rocketY = h * .34 + (touchdownY - h * .34) * descent * descent;
  if (t >= impactT && !launch.impactDone) {
    launch.impactDone = true;
    const intensity = launch.quality === "exceptional" ? 1.6 : launch.quality === "good" ? 1 : .65;
    burst(w * .5, ground, Math.round(38 * intensity), "#efcf81", (plan.safeLanding ? 3 : 5) * intensity);
    burst(w * .5, ground + 10, Math.round(20 * intensity), "#b6c8a5", 4 * intensity);
  }
  if (plan.safeLanding || t < impactT) {
    const bounce = plan.safeLanding ? Math.sin(impactAge * Math.PI * 2) * 8 * (1 - impactAge) : 0;
    drawRocket(w * .5, rocketY - bounce, rocketScale, (1 - descent) * .15, 0, state.upgrades, now);
  } else {
    // Crashed machine stays visibly crashed on the result screen.
    ctx.save(); ctx.translate(w * .5, ground - 8); ctx.rotate(.36);
    plate(-36, -10, 64, 22, "#c1b58a", 8);
    path([[-48, -9], [-39, -30], [-14, -12]], "#dc8051");
    plate(17, -21, 24, 18, "#47776a");
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const spread = Math.min(1, impactAge * 4);
      ctx.save(); ctx.translate(w * .5 + (i - 2.5) * 24 * spread, ground - Math.sin(spread * Math.PI) * 36 - i % 2 * 8);
      ctx.rotate(i + impactAge * 3);
      ctx.fillStyle = i % 2 ? "#e4c788" : "#7ba394"; ctx.fillRect(-6, -3, 12, 6); ctx.restore();
    }
  }
  // An exceptional existing outcome gets a stronger celebratory visual, no extra rewards.
  if (t >= impactT && launch.quality !== "mediocre") {
    const spectacular = launch.quality === "exceptional";
    const count = spectacular ? 10 : 6;
    ctx.strokeStyle = spectacular ? "#ffd575" : "#aad1a7";
    ctx.lineWidth = spectacular ? 2 : 1; ctx.globalAlpha = 1 - impactAge * .6;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const r = (spectacular ? 75 : 45) + impactAge * (spectacular ? 70 : 35);
      ctx.beginPath(); ctx.moveTo(w * .5 + Math.cos(angle) * r, ground + Math.sin(angle) * r * .45);
      ctx.lineTo(w * .5 + Math.cos(angle) * (r + 16), ground + Math.sin(angle) * (r + 16) * .45); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRocket(x, y, scale, rotation, thrust, levels, now) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
  const fuelExtra = Math.min(18, levels.fuel * 4);
  const top = -78 - fuelExtra;

  // Improvised kettle exhaust; upgrades add a conspicuous copper booster assembly.
  if (thrust > 0) {
    const flame = 23 + thrust * 49 + levels.engine * 9 + Math.sin(now * .028) * 9;
    const plume = ctx.createLinearGradient(0, 63, 0, 63 + flame);
    plume.addColorStop(0, "#fff7cf"); plume.addColorStop(.35, levels.engine > 0 ? "#b7f5db" : "#ffe297");
    plume.addColorStop(.7, "#ff8b46"); plume.addColorStop(1, "#ff8b4600");
    ctx.fillStyle = plume;
    ctx.beginPath(); ctx.moveTo(-15, 61); ctx.quadraticCurveTo(-24, 92, 4, 64 + flame);
    ctx.quadraticCurveTo(19, 87, 12, 61); ctx.fill();
    ctx.fillStyle = "#fff8d6";
    path([[-7, 62], [3, 92 + thrust * 22], [8, 62]], "#fff5c0", null);
  }
  plate(-22 - levels.engine * 2, 36, 45 + levels.engine * 4, 21, "#7c8b75", 7);
  path([[-16, 56], [-20 - levels.engine * 2, 72], [18 + levels.engine * 2, 72], [14, 55]], "#566b60");
  ctx.strokeStyle = "#d0ab6c"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, 65); ctx.lineTo(17, 65); ctx.stroke();
  if (levels.engine > 0) {
    plate(-34, 28, 12, 35, "#b97f51", 4); plate(25, 31, 11, 29, "#bd915e", 3);
    for (let i = 0; i < 4 + Math.min(3, levels.engine); i++) {
      ctx.strokeStyle = "#edbb73"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-33, 34 + i * 4); ctx.lineTo(-23, 34 + i * 4); ctx.stroke();
    }
    plate(-14, 43, 28, 10, "#73b5a0", 2);
  }

  // An uneven tin body, old enamel cone and mismatched fins.
  const enamel = ctx.createLinearGradient(-29, 0, 30, 0);
  enamel.addColorStop(0, "#9eac92"); enamel.addColorStop(.24, "#e7dbb2");
  enamel.addColorStop(.65, "#f4e4b8"); enamel.addColorStop(1, "#abb797");
  ctx.fillStyle = enamel; ctx.strokeStyle = "#193f3e"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-7, top);
  ctx.bezierCurveTo(28, top + 17, 33, -5, 23, 42);
  ctx.lineTo(-25, 43); ctx.bezierCurveTo(-37, 0, -31, top + 30, -7, top); ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#d7774d";
  ctx.beginPath(); ctx.moveTo(-7, top);
  ctx.bezierCurveTo(11, top + 5, 17, top + 20, 22, top + 31);
  ctx.lineTo(-26, top + 39); ctx.bezierCurveTo(-20, top + 16, -17, top + 10, -7, top); ctx.fill(); ctx.stroke();
  path([[-18, top + 23], [-11, top + 11], [-9, top + 14], [-16, top + 26]], "#efa870", null);
  path([[-22, 10], [-49, 47], [-29, 53], [-21, 37]], "#d47c4d");
  path([[23, 2], [44, 40], [38, 57], [23, 41]], "#517e67");
  ctx.strokeStyle = "#91b484"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(27, 22); ctx.lineTo(36, 43); ctx.stroke();

  // Dented porthole with four hand-tightened bolts.
  ctx.fillStyle = "#4b6a62"; ctx.beginPath(); ctx.arc(-6, top + 54, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#183c49"; ctx.beginPath(); ctx.arc(-6, top + 54, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8ed9d7"; ctx.beginPath(); ctx.arc(-8, top + 51, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d0f3dc"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, top + 50); ctx.lineTo(-8, top + 47); ctx.stroke();
  for (const [bx, by] of [[-18, 0], [6, 0], [-6, -12], [-6, 12]]) bolt(bx, top + 54 + by, 2);

  // Patch, warning sticker, band of duct tape and crooked number.
  ctx.save(); ctx.translate(6, 10); ctx.rotate(-.12);
  plate(-15, -9, 29, 22, "#64947b", 2); bolt(-10, -4); bolt(9, 8); ctx.restore();
  path([[-29, -3], [23, -10], [24, -2], [-27, 5]], "#9ba794", null);
  ctx.strokeStyle = "#dde0b6"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(12, -5); ctx.stroke();
  ctx.save(); ctx.rotate(.12);
  ctx.fillStyle = "#fff1c5"; ctx.font = "bold 13px Trebuchet MS"; ctx.fillText("07", -3, 19); ctx.restore();
  path([[-21, 24], [-9, 22], [-6, 34], [-21, 35]], "#dfb961", null);
  ctx.fillStyle = "#674c32"; ctx.font = "bold 10px Arial"; ctx.fillText("!", -17, 33);
  for (let i = 0; i < 4; i++) bolt(-26 + i % 2, -17 + i * 14, 2);
  ctx.strokeStyle = "#85957f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, -26); ctx.lineTo(20, -19); ctx.lineTo(16, -17); ctx.stroke();

  if (levels.fuel > 0) {
    plate(-45, -35 - fuelExtra * .3, 18, 60 + fuelExtra, "#56917a", 6);
    plate(26, -21 - fuelExtra, 20, 54 + fuelExtra, "#c4824c", 4);
    plate(-42, -39 - fuelExtra * .3, 9, 5, "#c2c6a1", 1);
    plate(30, -26 - fuelExtra, 10, 6, "#829584", 1);
    ctx.strokeStyle = "#cbbc88"; ctx.lineWidth = 4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.moveTo(-46, -17 + i * 27); ctx.lineTo(-28, -17 + i * 27);
      ctx.moveTo(27, -4 + i * 22); ctx.lineTo(47, -4 + i * 22); ctx.stroke();
    }
  }
  if (levels.hull > 0) {
    path([[-25, 2], [-5, 6], [-7, 37], [-26, 34]], "#b4bda5");
    path([[11, 1], [26, -3], [23, 37], [7, 36]], "#779884");
    bolt(-21, 8); bolt(-12, 29); bolt(19, 8); bolt(14, 29);
    ctx.strokeStyle = "#e2bf74"; ctx.lineWidth = 5;
    for (let i = 0; i < Math.min(3, levels.hull); i++) {
      ctx.beginPath(); ctx.moveTo(-26, 5 + i * 13); ctx.lineTo(26, 5 + i * 13); ctx.stroke();
    }
  }
  // Armour strips disappear on the ship as well as in the HUD.
  const armourCount=mode==="launch"?launch.run.sections:2+Number(levels.hull>0);
  for(let i=0;i<armourCount;i++){plate(-29,5+i*12,58,7,i===2?"#96d7c4":"#e2bf74",2);}
  if (levels.guidance > 0) {
    ctx.strokeStyle = "#d2c69b"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(19, top + 29); ctx.lineTo(38, top + 4); ctx.stroke();
    ctx.save(); ctx.translate(39, top); ctx.rotate(.3);
    ctx.fillStyle = "#debf76"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#acdacc"; ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(8, -7); ctx.stroke();
    ctx.fillStyle = "#91f1dc"; ctx.beginPath(); ctx.arc(8, -8, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else {
    ctx.strokeStyle = "#727b62"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(19, top + 32); ctx.lineTo(27, top + 12); ctx.lineTo(24, top + 8); ctx.stroke();
  }
  if (levels.magnet > 0) {
    ctx.save(); ctx.translate(39, 45); ctx.rotate(-.22);
    ctx.strokeStyle = "#bd684a"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = "#d7dbc4"; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-12, -8);
    ctx.moveTo(12, 0); ctx.lineTo(12, -8); ctx.stroke();
    ctx.strokeStyle = "#92efca"; ctx.lineWidth = 1.5;
    ctx.globalAlpha = .35 + (reducedMotion ? .3 : (Math.sin(now * .006) + 1) * .3);
    ctx.beginPath(); ctx.arc(0, -5, 23 + levels.magnet * 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function mixColor(a, b, t) {
  const values = a.map((value, index) => Math.round(value + (b[index] - value) * t));
  return `rgb(${values.join(",")})`;
}

function frame(now) {
  // Catch up low-FPS visible frames with fixed simulation substeps; hidden tabs pause.
  const dt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (mode === "launch") drawLaunch(now, dt);
  else if (mode === "result" && launch) {
    updateParticles(dt);
    drawFlightEnd(now);
    drawParticles();
  } else {
    updateParticles(dt);
    drawGarage(now);
  }
  requestAnimationFrame(frame);
}

dom.upgradeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade]");
  if (button) buyUpgrade(button.dataset.upgrade);
});

// Info interactions are bound separately by upgrade-feedback.js.
dom.tutorialClose.addEventListener("click",()=>dismissTutorial());
dom.collisionSuppress.addEventListener("click",()=>dismissTutorial(true));
dom.tutorialContinue.addEventListener("click",()=>dismissTutorial());
dom.tutorialSkip.addEventListener("click",event=>{event.stopPropagation();dismissTutorial(true);});
dom.tutorialOverlay.addEventListener("click",event=>{
 if(launch?.tutorial?.type!=='collision'&&(event.target===dom.tutorialOverlay||event.target===dom.tutorialSpot))dismissTutorial();
});

dom.launchButton.addEventListener("click", startLaunch);
dom.collectButton.addEventListener("click", collectReward);
dom.resetButton.addEventListener("click", resetGame);
// Pointer coordinates stay local to the canvas. Mouse hover and touch drag share one target.
function queueControl(){
 if(mode!=="launch"||launch.run.paused)return;
 const time=launch.run.time+launch.run.accumulator+(document.hidden?0:Math.max(0,(performance.now()-lastFrame)/1000));
 launch.controls.push(time,keyboardActive?{horizontal:keyboardDirection}:{x:targetX});
}
function pointerTarget(event){
 if(mode!=="launch"||launch.run.paused)return;
 const rect=canvasBounds;
 const control=pointerControl(event.clientX-rect.left,event.clientY-rect.top,rect.width);
 targetX=control.x;keyboardDirection=0;keyboardActive=false;heldKeys.clear();
 queueControl();
}
canvas.addEventListener("pointerdown",event=>{
 if(mode!=="launch"||launch.run.paused)return;
 canvasBounds=canvas.getBoundingClientRect();
 pointerId=event.pointerId;canvas.setPointerCapture(pointerId);pointerTarget(event);event.preventDefault();
});
canvas.addEventListener("pointermove",event=>{
 if(event.pointerType==="mouse"||event.pointerId===pointerId)pointerTarget(event);
});
function releasePointer(event){if(event.pointerId===pointerId)pointerId=null;}
canvas.addEventListener("pointerup",releasePointer);canvas.addEventListener("pointercancel",releasePointer);
window.addEventListener("keydown",event=>{
 if(launch?.run.paused){
  if(event.key==="Escape"){event.preventDefault();dismissTutorial();}
  if(event.key==="Tab"){
   event.preventDefault();const buttons=launch.tutorial?.type==='collision'?[dom.tutorialClose,dom.collisionSuppress]:[dom.tutorialContinue,dom.tutorialSkip];
   (document.activeElement===buttons[0]?buttons[1]:buttons[0]).focus();
  }
  return;
 }
 if(mode!=="launch")return;
 const key=event.key.toLowerCase();
 if(["arrowleft","a","arrowright","d"].includes(key)){
  heldKeys.add(key);keyboardActive=true;
  const control=keyboardControl(heldKeys);keyboardDirection=control.horizontal;
  queueControl();
  event.preventDefault();
 }
});
window.addEventListener("keyup",event=>{
 if(!["arrowleft","a","arrowright","d"].includes(event.key.toLowerCase()))return;
 heldKeys.delete(event.key.toLowerCase());
 const control=keyboardControl(heldKeys);keyboardDirection=control.horizontal;
 if(mode==="launch"&&!launch.run.paused)queueControl();
});
window.addEventListener("blur",()=>{keyboardDirection=0;heldKeys.clear();pointerId=null;queueControl();});
document.addEventListener("visibilitychange",()=>{lastFrame=performance.now();keyboardDirection=0;heldKeys.clear();if(mode==="launch")launch.controls.reset({x:launch.run.targetX});});
window.addEventListener("scroll",()=>{canvasBounds=canvas.getBoundingClientRect();upgradeFeedback.reposition();},{passive:true});
window.addEventListener("resize", resizeCanvas);
window.addEventListener('resize',()=>upgradeFeedback.reposition());
window.visualViewport?.addEventListener('resize',()=>upgradeFeedback.reposition());
window.visualViewport?.addEventListener('scroll',()=>upgradeFeedback.reposition());
new ResizeObserver(resizeCanvas).observe(canvas);

window.dispatchEvent(new CustomEvent("cosmic-startup-stage", {detail:"logic"}));
resizeCanvas();
renderGarageUi();
drawGarage(performance.now());
window.dispatchEvent(new CustomEvent("cosmic-startup-stage", {detail:"canvas"}));
requestAnimationFrame(frame);
