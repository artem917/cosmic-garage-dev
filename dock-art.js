// Original code-native workshop and physical 2+2+1 assembly. No bitmap assets.
export const SOCKETS=[{key:'nozzle',ordinal:0,x:122,y:111,label:'СОПЛО 1'},{key:'nozzle',ordinal:1,x:180,y:111,label:'СОПЛО 2'},{key:'coil',ordinal:0,x:87,y:61,label:'КАТУШКА 1'},{key:'coil',ordinal:1,x:215,y:61,label:'КАТУШКА 2'},{key:'core',ordinal:0,x:151,y:29,label:'ЯДРО'}];
export function partSvg(key){
 return key==='nozzle'?'<path d="M-8-12H8L5-2 13 13H-13L-5-2Z"/><path class="part-detail" d="M-8-9H8M-5-3H5M-10 10H10"/>':key==='coil'?'<path d="M-11-12H11V12H-11Z"/><path class="part-detail" d="M-14-10H14M-14-5H14M-14 0H14M-14 5H14M-14 10H14"/>':'<path d="M0-14 14 0 0 14-14 0Z"/><circle class="part-detail" r="5"/>';
}
export function socketState(state){return SOCKETS.map(s=>({...s,filled:state.rareParts[s.key]>s.ordinal}));}
export function blueprintSvg(state,arrivingPart=null){
 const sockets=socketState(state),complete=sockets.every(s=>s.filled);
 const newest=arrivingPart?sockets.find(s=>s.key===arrivingPart&&s.ordinal===state.rareParts[arrivingPart]-1):null;
 return `<svg viewBox="0 0 302 148" class="engine-blueprint${complete?' complete':''}${state.vacuumEngineBuilt?' assembled':''}" role="img" aria-label="Схема двигателя: ${sockets.filter(s=>s.filled).length} из 5 деталей${state.vacuumEngineBuilt?', двигатель собран':''}">
 <defs><pattern id="blueprintGrid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#5f9caa" stroke-opacity=".16"/></pattern></defs><rect width="302" height="148" rx="8" fill="url(#blueprintGrid)"/>
 <path class="engine-silhouette" d="M129 42H173L188 95 174 111H128L114 95ZM130 45V93M172 45V93M117 75H185M128 112V136H144V112M158 112V136H174V112"/>
 <path class="blueprint-cable" d="M104 61H125M177 61H198M151 43V57"/><path class="assembly-clamps" d="M111 44H123V79H111M179 44H191V79H179M116 96V104H186V96"/>
 ${sockets.map(s=>`<g class="engine-socket${s.filled?' filled':''}${s===newest?' socket-arriving':''}" data-part="${s.key}" data-filled="${s.filled}" role="img" aria-label="${s.label}: ${s.filled?'установлено':'пусто'}" transform="translate(${s.x} ${s.y})"><rect class="socket-mount" x="-21" y="-21" width="42" height="42" rx="6"/><g class="physical-part">${partSvg(s.key)}</g><path class="empty-slot" d="M-7 0H7M0-7V7"/><text x="0" y="32" text-anchor="middle">${s.label}</text></g>`).join('')}
 </svg>`;
}
export function workBaySvg({job=null,built=false}={}){
 return `<svg viewBox="0 0 360 200" class="work-bay-scene" role="img" aria-label="${built?'Собранный двигатель в орбитальной мастерской':job?'Орбитальный объект подвешен в ремонтном стапеле над Землёй':'Пустой ремонтный стапель над Землёй'}">
 <defs><linearGradient id="earthGlow" x2="0" y2="1"><stop stop-color="#9bf0e3"/><stop offset=".35" stop-color="#418fac"/><stop offset="1" stop-color="#214963"/></linearGradient><linearGradient id="baySteel"><stop stop-color="#c6c0a2"/><stop offset=".4" stop-color="#5f837f"/><stop offset="1" stop-color="#243f47"/></linearGradient></defs>
 <rect width="360" height="200" fill="#071e30"/><path d="M25 26H335V175H25Z" fill="#09283b" stroke="#416d73" stroke-width="8"/>
 <g fill="#cfeddc"><circle cx="60" cy="49" r="1"/><circle cx="264" cy="38" r="1"/><circle cx="307" cy="78" r="1.2"/><circle cx="219" cy="70" r=".8"/></g>
 <ellipse cx="187" cy="231" rx="225" ry="105" fill="url(#earthGlow)" stroke="#b4f9e6" stroke-width="4"/><path d="M58 162Q89 143 118 151L123 161 102 173 77 166M212 151Q260 147 299 171L270 177 256 168 223 167" fill="#8cae91" opacity=".8"/>
 <path d="M0 0H360V23H0ZM0 0H22V200H0ZM338 0H360V200H338Z" fill="url(#baySteel)"/><path d="M13 22V182M347 22V182" stroke="#152e38" stroke-width="6"/>
 <path d="M8 27H52L41 48H21M308 27H352L338 48H319" fill="#b4a374" stroke="#243e42" stroke-width="3"/>
 <path d="M41 6H89L101 22M263 5H302L320 23" stroke="#d0a963" stroke-width="3" fill="none"/><path d="M94 21Q80 42 111 61M267 21Q287 49 249 69" fill="none" stroke="#78978e" stroke-width="3"/>
 <path d="M0 184H360V200H0Z" fill="#2a4650"/><path d="M16 188H344" stroke="#92a88a" stroke-width="3"/><path d="M21 192H339" stroke="#b9a572" stroke-width="4" stroke-dasharray="12 9"/>
 <g class="bay-clamps" fill="#9bac94" stroke="#27454a" stroke-width="3"><path d="M68 72H112V91H92V124H68Z"/><path d="M292 72H248V91H268V124H292Z"/></g>
 ${job&&!built?`<g class="suspended-wreck"><path d="M136 22V64M226 22V64" stroke="#bdc5a5" stroke-width="3"/><path d="M111 68 142 61 136 142 107 134Z" fill="#376a84" stroke="#aebba0" stroke-width="3"/><path d="M119 75V127M132 71V132M112 98H139" stroke="#90a7a1"/><path d="M223 67 251 78 244 137 221 143Z" fill="#376a84" stroke="#aebba0" stroke-width="3"/><path d="M232 76V132M243 82V134M223 105H248" stroke="#90a7a1"/><path d="M139 59H223L231 141 153 148 130 121Z" fill="#b6bfa3" stroke="#294850" stroke-width="4"/><rect x="144" y="68" width="31" height="20" fill="#d4bd83" transform="rotate(-7 144 68)"/><circle cx="197" cy="101" r="20" fill="#274850" stroke="#798d76" stroke-width="6"/><path d="M181 86 199 113 214 91M145 110H167L157 128H142" fill="none" stroke="#789b87" stroke-width="5"/><text x="175" y="138" fill="#30534c" font-size="11">${String(job.template+1).padStart(2,'0')}</text></g>`:built?'<g class="bay-engine" fill="#c5d6a2" stroke="#315756" stroke-width="3"><path d="M150 49H211L219 122H141Z"/><path d="M144 120 134 154H168L163 120M195 120 190 154H224L214 120"/><path d="M138 66H154V109H138ZM207 66H223V109H207Z" fill="#bd9857"/><path d="M180 35 194 49 180 63 166 49Z" fill="#9ee8db"/><path d="M159 77H202M158 92H203M153 112H211" fill="none" stroke="#5c8576"/></g>':'<path class="empty-bay-outline" d="M140 60H220V147H140Z" stroke="#4d777d" stroke-dasharray="6 8" fill="none"/>'}
 </svg>`;
}
