import {ROUTE_END} from './game-logic.js';
import {TEMPLATES, powerPath} from './circuit-logic.js';

export const RECIPE = [{key:'nozzle',name:'ВАКУУМНОЕ СОПЛО',required:2},{key:'coil',name:'СВЕРХПРОВОДЯЩАЯ КАТУШКА',required:2},{key:'core',name:'НАВИГАЦИОННОЕ ЯДРО',required:1}];
const PART_ORDER = ['nozzle','coil','core','nozzle','coil'];
const count = v => Number.isSafeInteger(v) && v>=0 ? v : 0;
export const recipeComplete = state => RECIPE.every(p=>state.rareParts[p.key]>=p.required);
export const pendingJobs = state => state.salvageDiscovered-state.salvageCompleted;
export const currentJob = state => pendingJobs(state)>0 ? {id:state.salvageCompleted+1,template:(state.salvageCompleted)%TEMPLATES.length} : null;
export const nextPart = state => PART_ORDER.find(key=>state.rareParts[key]<RECIPE.find(p=>p.key===key).required) ?? null;

export function migrateOrbitState(base, raw) {
 const old=![1,2].includes(raw?.orbitHubVersion);
 const state={...base,orbitHubVersion:2,flightSerial:count(raw?.flightSerial),lastOrbitSerial:count(raw?.lastOrbitSerial),salvageDiscovered:0,salvageCompleted:0,rareParts:{},vacuumEngineBuilt:false,dockIntroSeen:false,puzzleIntroSeen:false,salvageReady:null};
 if(!old){
  state.lastOrbitSerial=Math.min(state.flightSerial,state.lastOrbitSerial);
  state.salvageDiscovered=count(raw?.salvageDiscovered);
  state.salvageCompleted=Math.min(state.salvageDiscovered,count(raw?.salvageCompleted));
  state.dockIntroSeen=raw?.dockIntroSeen===true;
  state.puzzleIntroSeen=raw?.puzzleIntroSeen===true||state.salvageCompleted>0||!!raw?.salvageReady;
 }
 for(const p of RECIPE)state.rareParts[p.key]=old?0:Math.min(p.required,count(raw?.rareParts?.[p.key]));
 state.vacuumEngineBuilt=!old&&raw?.vacuumEngineBuilt===true&&recipeComplete(state);
 if(old&&state.orbitUnlocked)state.salvageDiscovered=1; // One introductory object, never historical item drops.
 if(!state.orbitUnlocked){
  state.salvageDiscovered=state.salvageCompleted=0;state.vacuumEngineBuilt=false;state.dockIntroSeen=false;state.puzzleIntroSeen=false;
  for(const p of RECIPE)state.rareParts[p.key]=0;
 }
 const job=currentJob(state), part=nextPart(state);
 if(!old&&job&&part&&raw?.salvageReady?.jobId===job.id&&raw.salvageReady.part===part)state.salvageReady={jobId:job.id,part};
 return state;
}
export function beginOrbitRun(state) {
 state.flightSerial++;return state.flightSerial;
}
export function discoverOrbitObject(state,runId,result) {
 // Monotone durable run IDs make result/collect/reload replay harmless, including old IDs.
 if(result.reason!=='orbit'||result.distance<ROUTE_END||!Number.isSafeInteger(runId)||runId<=state.lastOrbitSerial||runId>state.flightSerial)return {granted:false,first:false};
 const first=!state.orbitUnlocked;
 state.lastOrbitSerial=runId;state.orbitUnlocked=true;state.salvageDiscovered++;
 return {granted:true,first};
}
export function prepareSalvageReward(state,jobId,puzzle) {
 const job=currentJob(state), part=nextPart(state);
 if(!state.orbitUnlocked||!job||job.id!==jobId||!part||state.vacuumEngineBuilt||puzzle.status!=='success'||puzzle.templateId!==TEMPLATES[job.template].id||!powerPath(puzzle.board).success)return false;
 if(state.salvageReady)return state.salvageReady.jobId===jobId;
 state.salvageReady={jobId,part};return true; // Persist BEFORE the visual energy sequence.
}
export function claimSalvageReward(state,jobId) {
 const job=currentJob(state), reward=state.salvageReady;
 if(!job||job.id!==jobId||reward?.jobId!==jobId||reward.part!==nextPart(state))return null;
 const part=reward.part;state.rareParts[part]++;state.salvageCompleted++;state.salvageReady=null;
 return part;
}
export function assembleEngine(state) {
 if(!state.orbitUnlocked||state.vacuumEngineBuilt||!recipeComplete(state))return false;
 state.vacuumEngineBuilt=true;return true; // Parts are installed; no Scrap cost or Earth stat bonus.
}
