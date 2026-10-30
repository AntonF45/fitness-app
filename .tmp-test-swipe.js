const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.MutationObserver = dom.window.MutationObserver;
global.CSS = dom.window.CSS || { escape: s => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&') };

let failures = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ': ' + name); if (!cond) failures++; }

global.stateObj = { activeWorkout: { exercises: [
  { name: 'Жим', exerciseType: 'weighted', targetSets: 3, targetReps: 10, sets: [
    { weight: 60, reps: 10, setType: 'regular' },
    { weight: 70, reps: 8,  setType: 'regular' },
    { weight: 80, reps: 6,  setType: 'regular' },
  ]}
]}};
const state = global.stateObj;

const vm = require('vm');
const ctx = {
  document: dom.window.document, window: dom.window, MutationObserver: dom.window.MutationObserver,
  CSS: global.CSS, console, setTimeout, clearTimeout, setInterval, clearInterval,
};
vm.createContext(ctx);
const srcAll = fs.readFileSync('js/ui/swipe-delete.js','utf8') + '\n'
             + fs.readFileSync('js/features/workout/workout.controller.js','utf8');
const stubs = `
var state = globalThis.S;
var saveActiveWorkout=function(){}, haptic=function(){}, showAlert=function(){}, showConfirm=function(){},
    closeWorkoutContextMenu=function(){}, cancelLongPress=function(){}, startTimer=function(){}, clearMainButton=function(){},
    getSupersetStyle=function(){return {styleAttr:'',badgeStyle:''};}, navigate=function(){},
    adjustWeight=function(v){return v;}, adjustReps=function(v){return v;}, escHtml=function(s){return String(s);};
`;
global.document = dom.window.document;
const MutationObserverPatched = true;
vm.runInContext(stubs + srcAll, Object.assign(ctx,{MO:dom.window.MutationObserver, S:state}));
const api = vm.runInContext('({ renderWorkout, removeSet, addSet, swipeLeftHandlers })', ctx);

check('delete-set handler зарегистрирован свайп-модулем', typeof api.swipeLeftHandlers['delete-set'] === 'function');

api.renderWorkout();
check('карточка отрисована: 3 строки', document.querySelectorAll('#exercise-card-0 .set-line').length === 3);

function touchEvt(el, type, x, y) {
  const Evt = el === dom.window ? dom.window.Event : dom.window.Event;
  const e = new Evt(type, { bubbles: true, cancelable: true });
  e.touches = (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientX: x, clientY: y }];
  e.changedTouches = [{ clientX: x, clientY: y }];
  el.dispatchEvent(e);
  return e;
}

// ── Сквозной свайп на строке 2 (setIdx=1): touchstart → touchmove(-80) → touchend ──
const zone = document.getElementById('set-row-0-1');
check('строка имеет data-swipe-left="delete-set"', zone && zone.dataset.swipeLeft === 'delete-set');

touchEvt(zone, 'touchstart', 300, 100);
touchEvt(window, 'touchmove', 220, 100);   // window-capture listener
touchEvt(zone, 'touchmove', 220, 100);
touchEvt(zone, 'touchend', 220, 100);

setTimeout(() => {
  check('данные обновлены: веса [60,80]', JSON.stringify(state.activeWorkout.exercises[0].sets.map(s=>s.weight)) === '[60,80]');
  const list = document.getElementById('sets-container-0');
  const kids = Array.from(list.children);
  check('в DOM нет строки с весом 70 (удалённый подход не вернулся)',
        !kids.some(li => { const i = li.querySelector('input[id$="-weight"]'); return i && i.value === '70'; }));
  const visibleRows = kids.filter(li => !li.classList.contains('set-collapsing'));
  check('видимых строк 2', visibleRows.length === 2);
  check('номера видимых строк 1 и 2', visibleRows.map(r => r.querySelector('.set-num').textContent.trim()).join(',') === '1,2');

  setTimeout(() => {
    const list2 = document.getElementById('sets-container-0');
    check('после финальной пересборки — ровно 2 строки', list2 && list2.children.length === 2);
    check('схлопнутых строк не осталось', list2 && !list2.querySelector('[data-swipe-removing="1"]'));

    // ── add-set после свайпа ──
    api.addSet(0);
    const list3 = document.getElementById('sets-container-0');
    check('add-set: 3 строки', list3.children.length === 3);
    check('add-set: без схлопнутых', !list3.querySelector('.set-collapsing'));

    // ── второй свайп: удаление последнего подхода ──
    const z2 = list3.children[2];
    touchEvt(z2, 'touchstart', 300, 100);
    touchEvt(window, 'touchmove', 210, 100);
    touchEvt(z2, 'touchmove', 210, 100);
    touchEvt(z2, 'touchend', 210, 100);
    setTimeout(() => {
      check('второй свайп: в данных 2 подхода', state.activeWorkout.exercises[0].sets.length === 2);
      const vis = Array.from(document.getElementById('sets-container-0').children).filter(li => !li.classList.contains('set-collapsing'));
      check('второй свайп: видимых строк 2', vis.length === 2);
      console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
      process.exit(failures === 0 ? 0 : 1);
    }, 550);
  }, 550);
}, 450);
