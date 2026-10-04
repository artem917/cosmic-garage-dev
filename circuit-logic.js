// Curated 5×5 networks. Ports: north=1, east=2, south=4, west=8.
export const BOARD_SIZE=5;
export const DIRECTIONS=[{bit:1,opposite:4,dr:-1,dc:0},{bit:2,opposite:8,dr:0,dc:1},{bit:4,opposite:1,dr:1,dc:0},{bit:8,opposite:2,dr:0,dc:-1}];
export const rotateMask=mask=>((mask<<1)&15)|(mask>>3);
export function tileMask(tile){let mask=tile.mask;for(let i=0;i<tile.rotation;i++)mask=rotateMask(mask);return mask;}
export function neighbor(index,direction){
 const row=Math.floor(index/5)+direction.dr,col=index%5+direction.dc;
 return row<0||row>=5||col<0||col>=5?-1:row*5+col;
}
export function powerPath(board){
 const source=board.findIndex(t=>t.kind==='source');
 const required=board.flatMap((tile,index)=>['target','relay'].includes(tile.kind)?[index]:[]);
 const targets=required.filter(i=>board[i].kind==='target');
 const powered=new Set(source<0?[]:[source]),queue=[...powered],parents=new Map(),depth=new Map(source<0?[]:[[source,0]]);
 for(let q=0;q<queue.length;q++){
  const index=queue[q],mask=tileMask(board[index]);
  for(const dir of DIRECTIONS){
   const next=neighbor(index,dir);
   if(next<0||powered.has(next)||board[next].kind==='blocked'||!(mask&dir.bit)||!(tileMask(board[next])&dir.opposite))continue;
   powered.add(next);parents.set(next,index);depth.set(next,depth.get(index)+1);queue.push(next);
  }
 }
 // Union of source paths to ALL reached objectives, in BFS order for branching energy flow.
 const useful=new Set();
 for(const endpoint of required)if(powered.has(endpoint)){let i=endpoint;while(i!==undefined){useful.add(i);i=parents.get(i);}}
 const path=queue.filter(i=>useful.has(i)),satisfied=required.filter(i=>powered.has(i)).length;
 return {powered,path,required,targets,satisfied,depth,success:source>=0&&targets.length>0&&satisfied===required.length};
}

// Authored solved edge lists and authored decoys: no uncontrolled generation.
// `solution` is one known legal solution, NOT a claimed global optimum.
const SPECS=[
 {name:'Солнечный регулятор',lesson:'ПЕРВЫЙ КОНТАКТ',source:0,targets:{24:'ЗАМОК'},relays:[],fixed:[],burned:[4,9,10,15,20,21],
  edges:[[0,1],[1,6],[6,7],[7,12],[12,13],[13,18],[18,19],[19,24]],
  turns:{1:1,6:1,7:1,12:1,13:1,18:1,19:1},decoys:{2:6,3:12,5:5,8:9,11:10,14:5,16:3,17:12,22:3,23:9}},
 {name:'Антенная кассета',lesson:'ЧЕРЕЗ РЕЛЕ',source:0,targets:{24:'ЗАМОК'},relays:[12],fixed:[],burned:[4,20],
  edges:[[0,1],[1,2],[2,7],[7,12],[12,13],[13,14],[14,19],[19,24]],
  turns:{1:1,2:3,7:1,13:1,14:3,19:1},decoys:{3:12,5:6,6:9,8:5,9:12,10:3,11:12,15:6,16:9,17:7,18:12,21:3,22:10,23:9}},
 {name:'Блок стабилизации',lesson:'ДВА КОНТУРА',source:0,targets:{14:'ЗАМОК',22:'СТАБИЛИЗАТОР'},relays:[],fixed:[9],burned:[4,20],
  edges:[[0,5],[5,6],[6,11],[11,12],[12,13],[13,14],[12,17],[17,22]],
  turns:{5:2,6:3,11:2,12:3,13:1,17:1},decoys:{1:6,2:12,3:5,7:3,8:9,9:5,10:6,15:3,16:12,18:6,19:12,21:10,23:3,24:9}},
 {name:'Силовой короб',lesson:'ЛОЖНЫЕ СЕТИ',source:0,targets:{14:'ЗАМОК'},relays:[],fixed:[6,10,9,21],burned:[4,20],
  edges:[[0,1],[1,6],[6,11],[11,10],[10,15],[15,16],[16,17],[17,12],[12,13],[13,14]],
  turns:{1:1,11:3,15:3,16:1,17:3,12:2,13:1},decoys:{2:6,3:12,5:10,7:3,8:9,9:5,18:6,19:12,21:10,22:5,23:3,24:9}},
 {name:'Навигационный отсек',lesson:'ПЕРВАЯ БОЛЬШАЯ СБОРКА',source:0,targets:{20:'ЗАМОК',24:'СТАБИЛИЗАТОР'},relays:[12],fixed:[9,22],burned:[4],
  edges:[[0,1],[1,6],[6,7],[7,12],[12,17],[17,16],[16,15],[15,20],[17,18],[18,19],[19,24]],
  turns:{1:3,6:2,7:3,17:3,16:1,15:2,18:1,19:2},decoys:{2:6,3:12,5:6,8:9,9:5,10:3,11:9,13:6,14:12,21:5,22:10,23:3}},
];
const bitTo=(from,to)=>to===from+1?2:to===from-1?8:to===from+5?4:1;
function build(spec,index){
 const board=Array.from({length:25},(_,i)=>({kind:spec.burned.includes(i)?'blocked':'connector',mask:spec.decoys[i]??0,rotation:0}));
 for(const [a,b] of spec.edges){board[a].mask|=bitTo(a,b);board[b].mask|=bitTo(b,a);}
 board[spec.source].kind='source';board[spec.source].label='ИСТОЧНИК';
 for(const i of spec.fixed)board[i].kind='fixed';
 for(const i of spec.relays){board[i].kind='relay';board[i].label='РЕЛЕ';}
 let number=0;for(const [cell,label] of Object.entries(spec.targets)){board[cell].kind='target';board[cell].label=label;board[cell].number=++number;}
 const solution=[];
 for(const [cell,clicks] of Object.entries(spec.turns)){
  if(board[cell].kind!=='connector')continue;
  board[cell].rotation=(4-clicks)%4;for(let n=0;n<clicks;n++)solution.push(Number(cell));
 }
 return {id:`circuit-v2-${index+1}`,name:spec.name,lesson:spec.lesson,board,solution,intended:solution.length,budget:solution.length+4};
}
function turnBoard(template,index,quarters,extraRelay=null,extraFixed=null){
 const transform=i=>{for(let n=0;n<quarters;n++)i=i%5*5+4-Math.floor(i/5);return i;};
 const board=Array(25);
 template.board.forEach((tile,index)=>{const t={...tile};for(let n=0;n<quarters;n++)t.mask=rotateMask(t.mask);board[transform(index)]=t;});
 if(extraRelay!==null){const t=board[transform(extraRelay)];t.kind='relay';t.label='РЕЛЕ';t.rotation=0;}
 if(extraFixed!==null){const t=board[transform(extraFixed)];t.kind='fixed';t.rotation=0;}
 const solution=template.solution.filter(i=>i!==extraRelay&&i!==extraFixed).map(transform);
 return {...template,id:`circuit-v2-${index+1}`,name:['Релейный мост','Двойной стабилизатор','Термоконтур','Доковый узел','Старый зонд'][index-5],board,solution,intended:solution.length,budget:solution.length+4};
}
const FIRST=SPECS.map(build);
export const TEMPLATES=[...FIRST,turnBoard(FIRST[1],5,2,7),turnBoard(FIRST[2],6,1,11),turnBoard(FIRST[3],7,2,12),turnBoard(FIRST[4],8,1,null,6),turnBoard(FIRST[4],9,2,7)];
export function createPuzzle(index=0){
 const t=TEMPLATES[((index%10)+10)%10];
 return {templateId:t.id,board:t.board.map(tile=>({...tile})),energy:t.budget,budget:t.budget,moves:0,status:'playing'};
}
export function rotateTile(puzzle,index){
 if(puzzle.status!=='playing'||!Number.isInteger(index)||puzzle.board[index]?.kind!=='connector')return false;
 puzzle.board[index].rotation=(puzzle.board[index].rotation+1)%4;puzzle.energy--;puzzle.moves++;
 if(powerPath(puzzle.board).success)puzzle.status='success';else if(puzzle.energy===0)puzzle.status='failed';
 return true;
}
export function retryPuzzle(puzzle){const i=TEMPLATES.findIndex(t=>t.id===puzzle.templateId);return createPuzzle(i<0?0:i);}
