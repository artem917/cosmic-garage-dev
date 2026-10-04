// Curated electronics. Bits: north, east, south, west. No random board generation.
export const BOARD_SIZE = 5;
export const DIRECTIONS = [{bit:1,opposite:4,dr:-1,dc:0},{bit:2,opposite:8,dr:0,dc:1},{bit:4,opposite:1,dr:1,dc:0},{bit:8,opposite:2,dr:0,dc:-1}];
export const rotateMask = mask => ((mask << 1) & 15) | (mask >> 3);
export function tileMask(tile) {
 let mask = tile.mask;
 for(let i=0;i<tile.rotation;i++) mask = rotateMask(mask);
 return mask;
}
export function neighbor(index, direction) {
 const row = Math.floor(index / BOARD_SIZE) + direction.dr, col = index % BOARD_SIZE + direction.dc;
 return row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE ? -1 : row * BOARD_SIZE + col;
}
export function powerPath(board) {
 const source = board.findIndex(t => t.kind === 'source'), target = board.findIndex(t => t.kind === 'target');
 const powered = new Set(source < 0 ? [] : [source]), queue = [...powered], parents = new Map();
 for(let q=0;q<queue.length;q++) {
  const index = queue[q], mask = tileMask(board[index]);
  for(const dir of DIRECTIONS) {
   const next = neighbor(index,dir);
   if(next<0 || powered.has(next) || board[next].kind==='blocked' || !(mask & dir.bit) || !(tileMask(board[next]) & dir.opposite)) continue;
   powered.add(next); parents.set(next,index); queue.push(next);
  }
 }
 const path = [];
 if(powered.has(target)) {let i=target;while(i!==undefined){path.unshift(i);i=parents.get(i);}}
 return {powered,path,success:target>=0 && powered.has(target)};
}
// Every curated route is monotone: non-consecutive cells cannot be adjacent.
// Thus there is exactly one geometric route; its rotation cost is the true minimum.
const ROUTES = ['RDRDRDRD','DRDRDRDR','RRDDRRDD','DDRRDDRR','RDDRDRRD','DRRDRDDR','RRDRDDRD','DDRDRRDR','RDRRDDDR','DRDDRRRD'];
export const TEMPLATES = ROUTES.map((route,index) => {
 const path = [0];for(const step of route)path.push(path.at(-1)+(step==='R'?1:5));
 const board = Array.from({length:25},()=>({kind:'blocked',mask:0,rotation:0}));
 const bitTo = (from,to) => to===from+1?2:to===from-1?8:to===from+5?4:1;
 path.forEach((cell,p) => {
  const mask = (p ? bitTo(cell,path[p-1]) : 0) | (p<path.length-1 ? bitTo(cell,path[p+1]) : 0);
  board[cell]={kind:p===0?'source':p===path.length-1?'target':'connector',mask,rotation:p>0&&p<path.length-1?3:0};
 });
 const corner=path.find(cell=>board[cell].kind==='connector' && ![5,10].includes(board[cell].mask));
 board[corner].rotation = [3,2,1][index%3];
 const minimum = path.reduce((n,cell)=>{
  const tile=board[cell];if(tile.kind!=='connector')return n;
  let mask=tileMask(tile),clicks=0;while(mask!==tile.mask){mask=rotateMask(mask);clicks++;}return n+clicks;
 },0);
 return {id:`circuit-${index+1}`,name:['Солнечный регулятор','Антенная кассета','Блок стабилизации','Силовой короб','Навигационный отсек','Термоконтроллер','Усилитель маяка','Доковый релейный блок','Старый зонд','Панель грузового спутника'][index],board,path,minimum,budget:minimum+4};
});
export function createPuzzle(index=0) {
 const template=TEMPLATES[((index%TEMPLATES.length)+TEMPLATES.length)%TEMPLATES.length];
 return {templateId:template.id,board:template.board.map(t=>({...t})),energy:template.budget,budget:template.budget,moves:0,status:'playing'};
}
export function rotateTile(puzzle,index) {
 if(puzzle.status!=='playing' || !Number.isInteger(index) || puzzle.board[index]?.kind!=='connector')return false;
 const tile=puzzle.board[index];tile.rotation=(tile.rotation+1)%4;
 puzzle.energy--;puzzle.moves++;
 if(powerPath(puzzle.board).success)puzzle.status='success';
 else if(puzzle.energy===0)puzzle.status='failed';
 return true;
}
export function retryPuzzle(puzzle) {
 const index=TEMPLATES.findIndex(t=>t.id===puzzle.templateId);
 return createPuzzle(index<0?0:index);
}
