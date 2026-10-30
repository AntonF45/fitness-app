const { JSDOM } = require('jsdom');
const fs = require('fs');
const vm = require('vm');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { pretendToBeVisual: true });
class StubMO { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} takeRecords() { return []; } }
const ctx = { document: dom.window.document, window: dom.window, MutationObserver: StubMO,
  CSS: { escape: s => s }, console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };

ctx.state = { activeWorkout: { programName: 'P', startTime: Date.now(), exercises: [
  { name: 'Жим', exerciseType: 'weighted', targetSets: 3, targetReps: 10, sets: [
    { weight: 60, reps: 10, setType: 'regular' },
    { weight: 70, reps: 8,  setType: 'regular' },
    { weight: 80, reps: 6,  setType: 'regular' },
  ]},
  { name: 'Тяга', exerciseType: 'weighted', targetSets: 2, targetReps: 12, sets: [
    { weight: 100, reps: 12, setType: 'regular' },
  ]},
]}};

const stubs = `var saveActiveWorkout=function(){}, haptic=function(){}, showAlert=function(m){console.log('ALERT:',m);},
showConfirm=function(m,cb){cb(true);}, closeWorkoutContextMenu=function(){}, cancelLongPress=function(){},
startTimer=function(){}, clearMainButton=function(){}, getSupersetStyle=function(){return {styleAttr:"",badgeStyle:""};},
navigate=function(){}, adjustWeight=function(v,d){return Math.max(0,(Number(v)||0)+Number(d));},
adjustReps=function(v,d){return Math.max(0,(Number(v)||0)+Number(d));}, escHtml=function(s){return String(s);},
escAttr=function(s){return String(s).replace(/"/g,'&quot;');}, parseWeight=function(v){var n=parseFloat(v);return isNaN(n)?null:n;},
parseReps=function(v){var n=parseInt(v,10);return isNaN(n)?null:n;}, updateSet=function(e,s,f,v){state.activeWorkout.exercises[e].sets[s][f]=v;},
openProgramsScreen=function(){}, addSetHandler=null;`;

let src = fs.readFileSync('js/state/set-input-drafts.js','utf8') + '\n'
  + fs.readFileSync('js/ui/swipe-delete.js','utf8') + '\n'
  + stubs + '\n'
  + fs.readFileSync('js/features/workout/workout.controller.js','utf8');
src = src.replace("if (typeof window.bindSwipeZones === 'function') window.bindSwipeZones();", "window.bindSwipeZones();");
vm.createContext(ctx);
vm.runInContext(src, ctx);
vm.runInContext('renderWorkout()', ctx);

const doc = dom.window.document;
function touchEvt(el, type, x, y) {
  const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
  e.touches = (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientX: x, clientY: y }];
  e.changedTouches = [{ clientX: x, clientY: y }];
  el.dispatchEvent(e);
  return e;
}
const S = () => JSON.stringify(ctx.state.activeWorkout.exercises.map(ex => ex.sets.map(s => s.weight + 'x' + s.reps)));
const weights = () => Array.prototype.map.call(doc.querySelectorAll('#sets-container-0 .set-line'), li => li.querySelector('.set-num').innerText + ':' + li.querySelector('[data-field=weight]').value).join(' | ');
const fail = m => { console.log('FAIL:', m); process.exitCode = 1; };

(async function run() {
  // ── 1. свайп среднего подхода удаляет его, остальные НЕ «воскрешаются» ──
  let zone = doc.getElementById('set-row-0-1');
  if (!zone) return fail('нет строки 0-1');
  touchEvt(zone, 'touchstart', 300, 100);
  touchEvt(zone, 'touchmove', 200, 104);
  touchEvt(zone, 'touchend', 200, 104);
  await new Promise(r => setTimeout(r, 500));
  console.log('1) после свайпа state:', S());
  console.log('   DOM строк упражнения 0:', weights());
  if (S() !== '["60x10,80x6"],["100x12"]') fail('подход не удалён из state');
  if (doc.querySelectorAll('#sets-container-0 .set-line').length !== 2) fail('в DOM осталось не 2 строки');
  if (/70/.test(weights())) fail('значение удалённого подхода «воскресло» в DOM');
  if (weights() !== '1:60 | 2:80') fail('перенумерация/значения неверны: ' + weights());
  if (doc.getElementById('badge-0').innerText !== '2/3') fail('badge неверный: ' + doc.getElementById('badge-0').innerText);

  // ── 2. ввод без blur (change не наступил) сохраняется при перерисовке ──
  const inp = doc.getElementById('set-0-0-weight');
  inp.value = '65';
  inp.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  vm.runInContext('tryAddSet(0)', ctx);
  await new Promise(r => setTimeout(r, 50));
  console.log('2) после «+ Подход»: state', S());
  console.log('   DOM:', weights());
  if (weights() !== '1:65 | 2:80 | 3:80') fail('введённое до blur значение потеряно: ' + weights());
  if (doc.getElementById('badge-0').innerText !== '3/3') fail('badge после добавления: ' + doc.getElementById('badge-0').innerText);

  // ── 3. свайп последнего подхода + дроп-сет ──
  zone = doc.getElementById('set-row-0-2');
  touchEvt(zone, 'touchstart', 300, 100);
  touchEvt(zone, 'touchmove', 190, 100);
  touchEvt(zone, 'touchend', 190, 100);
  await new Promise(r => setTimeout(r, 500));
  console.log('3) state:', S(), '| DOM:', weights());
  if (S() !== '["65x10,80x8"],["100x12"]') fail('свайп последнего не сработал: ' + S());

  vm.runInContext('addDropSet(0)', ctx);
  console.log('4) дроп-сет state:', S(), '| DOM:', weights());
  if (S() !== '["65x10,80x8,60x8"],["100x12"]') fail('дроп-сет не добавлен');
  if (doc.querySelectorAll('#sets-container-0 .set-drop').length !== 1) fail('нет пометки дроп-подхода');

  // ── 4. удаление первого подхода сдвигает черновики ──
  vm.runInContext('removeSet(0, 0)', ctx);
  console.log('5) removeSet(0,0):', S(), '| DOM:', weights());
  if (weights() !== '1:80 | 2:60') fail('черновики не сдвинулись: ' + weights());

  // ── 5. очистка поля (пустая строка) не «восстанавливается» перерисовкой ──
  const w2 = doc.getElementById('set-0-0-weight');
  w2.value = '';
  w2.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  vm.runInContext('addSet(0)', ctx);
  console.log('6) пустое поле после перерисовки:', weights());
  if (weights() !== '1: | 2:60 | 3:60') fail('пустое значение затёрто state: ' + weights());

  console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  process.exit(process.exitCode || 0);
})();
