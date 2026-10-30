const { JSDOM } = require('jsdom');
const fs = require('fs');
const vm = require('vm');
const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { pretendToBeVisual: true });
const state = { activeWorkout: { exercises: [
  { name: 'Жим', exerciseType: 'weighted', targetSets: 3, targetReps: 10, sets: [
    { weight: 60, reps: 10, setType: 'regular' },
    { weight: 70, reps: 8,  setType: 'regular' },
    { weight: 80, reps: 6,  setType: 'regular' },
  ]}
]}};
// no-op MutationObserver class (node has global MutationObserver? no) — provide stub via window patch BEFORE context
class StubMO { observe(){} disconnect(){} takeRecords(){return [];} }
const ctx = { document: dom.window.document, window: dom.window, MutationObserver: StubMO,
  CSS: {escape:s=>s}, console, setTimeout, clearTimeout };
ctx.state = state;
const stubs = 'var saveActiveWorkout=function(){}, haptic=function(){}, showAlert=function(){}, showConfirm=function(){}, closeWorkoutContextMenu=function(){}, cancelLongPress=function(){}, startTimer=function(){}, clearMainButton=function(){}, getSupersetStyle=function(){return {styleAttr:"",badgeStyle:""};}, navigate=function(){}, adjustWeight=function(v){return v;}, adjustReps=function(v){return v;}, escHtml=function(s){return String(s);};';
let srcAll = fs.readFileSync('js/ui/swipe-delete.js','utf8') + '\n' + stubs + '\n'
  + fs.readFileSync('js/features/workout/workout.controller.js','utf8');
srcAll = srcAll.replace("registerSwipeLeftHandler('delete-set', function (action, payload) {",
  "registerSwipeLeftHandler('delete-set', function (action, payload) { console.log('>>> HANDLER CALLED', action, payload);");
srcAll = srcAll.replace("function collapseAndDelete(action, payload) {",
  "function collapseAndDelete(action, payload) { console.log('>>> collapseAndDelete', action, payload);");
srcAll = srcAll.replace("const handler = swipeLeftHandlers[action];",
  "console.log('>>> callHandler'); const handler = swipeLeftHandlers[action];");
srcAll = srcAll.replace("if (triggerDx <= -SWIPE_TRIGGER_DX) {", "console.log('>>> finish wasEngaged', wasEngaged, 'triggerDx', triggerDx); if (triggerDx <= -SWIPE_TRIGGER_DX) {");
vm.createContext(ctx);
vm.runInContext(srcAll, ctx);
vm.runInContext('renderWorkout()', ctx);
const doc = dom.window.document;
function touchEvt(el, type, x, y) {
  const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
  e.touches = (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientX: x, clientY: y }];
  e.changedTouches = [{ clientX: x, clientY: y }];
  el.dispatchEvent(e);
  return e;
}
const zone = doc.getElementById('set-row-0-1');
console.log('zone found:', !!zone, 'bound:', zone && zone.dataset.swipeBound);
touchEvt(zone, 'touchstart', 300, 100);
touchEvt(zone, 'touchmove', 220, 100);
touchEvt(zone, 'touchend', 220, 100);
setTimeout(() => {
  console.log('weights now:', JSON.stringify(state.activeWorkout.exercises[0].sets.map(s=>s.weight)));
  process.exit(0);
}, 600);
