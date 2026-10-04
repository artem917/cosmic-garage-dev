// Presentation only. A genuine ended Orbit run is already immutable in the Earth simulator.
export const victoryDuration=first=>first?2600:1300;
export function victoryFrame(first,elapsed){
 const duration=victoryDuration(first),progress=Math.max(0,Math.min(1,elapsed/duration));
 return {progress,coast:Math.max(0,Math.min(1,elapsed/800)),title:elapsed>=250,unlock:first&&elapsed>=1300,discovery:elapsed>=(first?1600:550),complete:elapsed>=duration};
}
export function createOrbitVictory({panel,unlock,discovery,onFinished}){
 let first=false,start=0,active=false;
 return {
  begin(isFirst,time){first=isFirst;start=time;active=true;panel.hidden=false;panel.dataset.first=first;panel.dataset.title=false;unlock.hidden=true;discovery.hidden=true;},
  tick(time){
   if(!active)return null;
   const view=victoryFrame(first,Math.max(0,time-start));
   panel.dataset.title=view.title;unlock.hidden=!view.unlock;discovery.hidden=!view.discovery;
   if(view.complete){active=false;panel.hidden=true;onFinished();}
   return view;
  },
  hide(){active=false;panel.hidden=true;},
 };
}
