const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM(`<!doctype html><html><body><div id="app-content"></div></body></html>`, { pretendToBeVisual: true, url: 'https://localhost/' });
const vm = require('vm');
const ctx = { window: dom.window, document: dom.window.document, console, setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle: dom.window.getComputedStyle, navigator: dom.window.navigator, localStorage: dom.window.localStorage,
  Date, Math, JSON, parseInt, String, Number, Array, Object, Set, RegExp, isNaN, parseFloat, Error,
  requestAnimationFrame: (fn)=>setTimeout(fn,0), alert(){}, MutationObserver: dom.window.MutationObserver, Event: dom.window.Event };
Object.getOwnPropertyNames(dom.window).forEach(function(k){ if(!(k in ctx)) { try { ctx[k]=dom.window[k]; } catch(e){} } });
vm.createContext(ctx);

vm.runInContext(`
var state = { activeWorkout: null, workoutTimer: null };
var USER_ID = 'test';
function escHtml(s){return String(s);} function escAttr(s){return String(s);}
function parseWeight(v){const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n;}
function parseReps(v){const n=parseInt(v,10);return isNaN(n)?null:n;}
function adjustWeight(c,d){return Math.max(0,c+d);} function adjustReps(c,d){return Math.max(1,c+d);}
function haptic(){} function showAlert(){} function showConfirm(m,cb){cb(true);}
function saveActiveWorkout(){} function startTimer(){} function clearMainButton(){} function navigate(){} function openProgramsScreen(){}
var DataAPI={getProgramById:function(){return null;}};
function updateExerciseBadge(exIdx){
  const ex = state.activeWorkout.exercises[exIdx];
  const completed = countCompletedSets(exIdx);
  const el = document.getElementById('badge-'+exIdx);
  if(el) el.textContent = completed + '/' + (ex.targetSets ?? 3);
}
function getSupersetStyle(){return {styleAttr:'',badgeStyle:''};}
`, ctx);

vm.runInContext(fs.readFileSync('js/state/set-input-drafts.js','utf8'), ctx);
vm.runInContext(fs.readFileSync('js/ui/swipe-delete.js','utf8'), ctx);
vm.runInContext(fs.readFileSync('js/features/workout/workout.controller.js','utf8'), ctx);

vm.runInContext(`
state.activeWorkout = { startTime: Date.now(), exercises: [{ name:'Жим', exerciseType:'weighted', targetSets:3, targetReps:10,
  sets: [ {id:'set_a', weight:50, reps:10, setType:'regular'}, {id:'set_b', weight:60, reps:8, setType:'regular'}, {id:'set_c', weight:70, reps:6, setType:'regular'} ] }] };
document.getElementById('app-content').innerHTML = generateExerciseCardHTML(0, state.activeWorkout.exercises[0]);
window.bindSwipeZones();
`, ctx);

const doc = dom.window.document;
function rows(){ return [...doc.querySelectorAll('#sets-container-0 .set-line')]; }
console.log('initial rows:', rows().length, rows().map(r=>r.dataset.setId));

function mkPtr(type, x, y, id) {
  const E = dom.window.PointerEvent || dom.window.Event;
  const e = new E(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerId', { value: id });
  Object.defineProperty(e, 'clientX', { value: x });
  Object.defineProperty(e, 'clientY', { value: y });
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  Object.defineProperty(e, 'button', { value: 0 });
  return e;
}
// Pointer-путь (основной в браузере): pointerdown на зоне -> move/up на window
// (jsdom не реализует capture-фазу для dispatchEvent, поэтому вызываем слушатели вручную).
function swipe(zone) {
  zone.dispatchEvent(mkPtr('pointerdown', 200, 100, 1));
  dom.window.dispatchEvent(mkPtr('pointermove', 140, 105, 1));
  dom.window.dispatchEvent(mkPtr('pointermove', 100, 105, 1));
  dom.window.dispatchEvent(mkPtr('pointerup', 100, 105, 1));
}

const zoneB = rows()[1];
// debug: is touchmove listener firing?
vm.runInContext(`
window.__dbg = [];
const origLog = console.log;
`, ctx);
swipe(zoneB);
console.log('zoneB mswipeDead after swipe start:', !!zoneB.mswipeDead, 'display:', zoneB.style.display);

setTimeout(() => {
  const r = rows();
  const st = vm.runInContext("state.activeWorkout.exercises[0].sets.map(s=>s.id)", ctx);
  console.log('rows after swipe+anim:', r.length, r.map(x=>x.dataset.setId));
  console.log('state sets:', st);
  console.log('badge:', doc.getElementById('badge-0').textContent);
  vm.runInContext("tryAddSet(0)", ctx);
  const r2 = rows();
  const st2 = vm.runInContext("state.activeWorkout.exercises[0].sets.map(s=>s.id)", ctx);
  console.log('rows after addSet:', r2.length, r2.map(x=>x.dataset.setId));
  console.log('ghosts remaining:', doc.querySelectorAll('.set-ghost').length);
  const pass = r2.length===3 && !r2.some(x=>x.dataset.setId==='set_b') && !st2.includes('set_b') && st2.length===3;
  console.log(pass ? 'TEST PASS' : 'TEST FAIL');
  process.exit(pass?0:1);
}, 900);
