// Presentation only: consumes completed events, never writes flight/economy state.
export const MOBILE_FEEDBACK_QUERY = '(max-width: 600px)';

export function tutorialTop({mobile, height, bubbleHeight, anchorY}) {
 if (!mobile) return Math.max(100, Math.min(anchorY + 55, height - bubbleHeight - 14));
 // Mobile anchors above the rocket, not below a moving pickup. CSS mirrors this
 // constraint so a viewport resize cannot leave even one frame in the thumb zone.
 return Math.max(12, height * .60 - bubbleHeight - 55);
}

export function pickupTextCovered(mobile, y, height) {
 // Keep icon/hitbox dimensions; suppress only the label before it enters the thumb zone.
 return mobile && y + 32 > height * 2 / 3;
}

export function createFlightFeedback(dom, isMobile, reducedMotion = false) {
 let fuelUntil = 0, cargoUntil = 0, toastUntil = 0;
 function reset() {
  fuelUntil = cargoUntil = toastUntil = 0;
  for (const node of [dom.fuelGain, dom.cargoGain, dom.eventToast]) node.hidden = true;
 }
 function show(event, now, run, hazardTitle) {
  if (event.type === 'fuel') {
   dom.fuelGain.textContent = `+${event.gain.toFixed(1)} с`;
   dom.fuelGain.hidden = false; fuelUntil = now + 1400;
   dom.fuelHud.getAnimations().forEach(a => a.cancel());
   dom.fuelGain.getAnimations().forEach(a => a.cancel());
   dom.fuelHud.animate([{backgroundColor:'#97f4c9',color:'#153d34',transform:'scale(1.07)'},{backgroundColor:'#133a36',color:'#a1f4d8',transform:'scale(1)'}], {duration:reducedMotion ? 1 : 1000});
   dom.fuelGain.animate([{opacity:1,transform:'translateY(0)'},{opacity:1,transform:'translateY(-7px)',offset:.75},{opacity:0,transform:'translateY(-12px)'}], {duration:reducedMotion ? 1 : 1400, fill:'none'});
   const denominator = Math.max(run.stats.fuel, event.after);
   dom.fuelMeter.animate([{transform:`scaleX(${event.before / denominator})`},{transform:`scaleX(${event.after / denominator})`}], {duration:reducedMotion ? 1 : 260});
  }
  if (isMobile() && (event.type === 'scrap' || event.type === 'salvage')) {
   dom.cargoGain.textContent = event.text;
   dom.cargoGain.hidden = false; cargoUntil = now + 1100;
   dom.cargoHud.getAnimations().forEach(a => a.cancel());
   dom.cargoGain.getAnimations().forEach(a => a.cancel());
   dom.cargoHud.animate([{backgroundColor:'#ffda77',color:'#173d36',transform:'scale(1.15)'},{backgroundColor:'transparent',color:'#fff2d2',transform:'scale(1)'}], {duration:reducedMotion ? 1 : 800});
   dom.cargoGain.animate([{opacity:1,transform:'translateY(0)'},{opacity:1,transform:'translateY(-5px)',offset:.8},{opacity:0,transform:'translateY(-10px)'}], {duration:reducedMotion ? 1 : 1100, fill:'none'});
  }
  // Desktop keeps its existing toast; mobile pickups never open a generic notification.
  // In particular a pickup must not overwrite a still-visible collision warning.
  if (isMobile() && event.type !== 'hazard') return;
  dom.eventTitle.textContent = event.type === 'hazard' ? hazardTitle : 'ПОДОБРАНО';
  dom.eventMessage.textContent = event.text; dom.eventResult.textContent = '';
  dom.eventToast.dataset.impact = event.type === 'hazard' ? 'hit' : 'clear';
  dom.eventToast.hidden = false; toastUntil = now + 1250;
 }
 function tick(now) {
  if (now > fuelUntil) dom.fuelGain.hidden = true;
  if (now > cargoUntil) dom.cargoGain.hidden = true;
  if (now > toastUntil) dom.eventToast.hidden = true;
 }
 return {show, tick, reset};
}
