// Original code-native placeholders. Silhouettes stay inside collision bounds.
const drawings={
 container:'<path d="M20 0v8m60-8v8" stroke="#ded9ac" stroke-width="3"/><rect x="2" y="8" width="96" height="26" rx="3" fill="#a77449"/><path d="M12 12v18m15-18v18m15-18v18m15-18v18m15-18v18m15-18v18" stroke="#deb277" stroke-width="3"/><path d="M3 9h94M3 33h94" stroke="#3d4940" stroke-width="3"/>',
 crane:'<path d="M2 8h96v16H2z" fill="#d7a35b"/><path d="m2 8 16 16L34 8l16 16L66 8l16 16L98 8" fill="none" stroke="#4f665d" stroke-width="3"/><path d="M12 25v9m76-9v9" stroke="#fff3bd" stroke-width="3"/><circle cx="50" cy="16" r="5" fill="#324c4c"/>',
 hook:'<path d="M50 0v15q-25 0-17 16 15 10 27-5" fill="none" stroke="#f6c27f" stroke-width="8"/><path d="M12 7h76v7H12z" fill="#709f96"/>',
 drone:'<path d="M3 7h28m38 0h28M16 5v16m68-16v16M18 19h64" stroke="#dce9d1" stroke-width="4"/><path d="M34 14h32v17H34z" fill="#649c9e"/><circle cx="50" cy="29" r="4" fill="#ffb06c"/>',
 cloud:'<path d="M2 30V15Q5 4 23 9Q35-5 53 8Q67-1 79 10Q98 4 98 20v13z" fill="#c1d8d8" stroke="#577c91" stroke-width="2"/><path d="M9 23q18-7 27 0m16-4q22-7 37 3" fill="none" stroke="#7094a6" stroke-width="2"/>',
 storm:'<path d="M2 32V15Q6 4 23 10Q36-4 54 8Q69-2 82 11Q98 5 98 24v9z" fill="#45596e" stroke="#aec7dd" stroke-width="2"/><path d="m18 25-3 8m22-8-3 8m28-8-3 8m26-8-3 8" stroke="#a7dae7" stroke-width="3"/>',
 glider:'<path d="m3 22 39-7L50 3l8 12 39 7-2 7-37-5-8 9-8-9-37 5z" fill="#eed6a5" stroke="#577d88" stroke-width="2"/>',
 flock:'<path d="m3 13 10-6 10 6m9 10 10-6 10 6m9-10 10-6 10 6m-2 20 10-6 10 6" fill="none" stroke="#2d526a" stroke-width="4"/>',
 hail:'<path d="m8 6 13 0-4 13H4zm33 7 15 0-6 15H36zm35-8 17 0-5 15H72z" fill="#d6edf0" stroke="#7fa9c4" stroke-width="2"/>',
 lightning:'<path d="M2 2h96v32H2z" fill="#3c4b6388"/><path d="m25 0-8 15h12l-7 21M61 0l-9 16h12l-8 20M88 0l-8 15h11l-8 21" fill="none" stroke="#fff3a4" stroke-width="4"/>',
 balloon:'<ellipse cx="50" cy="12" rx="35" ry="11" fill="#e7d9b5" stroke="#8fa5a3" stroke-width="2"/><path d="m22 18 18 14h20l18-14M40 32h20" fill="none" stroke="#b9d0cb" stroke-width="3"/><rect x="40" y="27" width="20" height="8" fill="#709a98"/>',
 research:'<rect x="3" y="8" width="24" height="23" fill="#6b8da8"/><rect x="73" y="8" width="24" height="23" fill="#6b8da8"/><path d="M26 18h48m-59-9v22m70-22v22M7 19h16m54 0h16" stroke="#b6cee0" stroke-width="2"/><rect x="34" y="8" width="32" height="25" rx="5" fill="#d0c7a7"/><path d="m50 8 12-7" stroke="#f4dd9a" stroke-width="3"/>',
 satellite:'<path d="M2 4h30v28H2zM68 4h30v28H68z" fill="#477da5" stroke="#add7ea" stroke-width="2"/><path d="M12 4v28m10-28v28m56-28v28m10-28v28M2 18h30m36 0h30" stroke="#90b7d3"/><path d="M32 18h36" stroke="#ddd5b7" stroke-width="4"/><rect x="38" y="7" width="24" height="24" rx="5" fill="#c7bca2"/><path d="m50 7 8-7" stroke="#fff0b9" stroke-width="3"/>',
 'spent-stage':'<path d="m3 18 15-13h65l14 13-14 13H18z" fill="#a4b3bb" stroke="#526e85" stroke-width="2"/><path d="M24 5v26m48-26v26" stroke="#d5d6ba" stroke-width="4"/><path d="m42 7 10 8-7 7 11 7" stroke="#677b87" fill="none" stroke-width="3"/>',
 meteor:'<path d="m14 3 32 0 17 10 24-6 11 17-15 10-41-4-26 6L2 20z" fill="#85786a" stroke="#b7aa8e" stroke-width="2"/><path d="m23 12 17 4-6 10m34-8 15 7" stroke="#615a5b" stroke-width="4"/>',
 'orbital-field':'<path d="M4 3h92v30H4z" fill="#6983ac55" stroke="#a5cde6" stroke-width="2"/><path d="m7 30 18-24m7 24L50 6m7 24L75 6m7 24L96 9" stroke="#cbe9e4" stroke-width="3"/>',
};
export function hazardSvg(skin){return `<svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">${drawings[skin]??drawings.container}</svg>`;}
export const HAZARD_NAMES={container:'Подвешенный контейнер',crane:'Стрела крана',hook:'Крюк погрузчика',drone:'Строительный дрон',cloud:'Плотный облачный фронт',storm:'Грозовой фронт',glider:'Планер',flock:'Стая птиц',hail:'Град',lightning:'Разряд — предварительное предупреждение',balloon:'Метеозонд',research:'Высотная аппаратура',satellite:'Спутник с панелями','spent-stage':'Отработанная ступень',meteor:'Орбитальный обломок','orbital-field':'Зона вращающихся обломков'};
