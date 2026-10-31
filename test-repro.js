/* Временный сквозной тест: 5/10/15 → свайп-удаление 10 → «+ Подход». */
'use strict';
const fs = require('fs');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { pretendToBeVisual: true, runScripts: 'outside-only' });
// jsdom не реализует PointerEvent — включаем в тестах touch-фолбэк ветку swipe-delete.
dom.window.PointerEvent = undefined;
const win = dom.window;
global.window = win;
global.document = win.document;
global.MutationObserver = win.MutationObserver;
Object.defineProperty(win, 'requestAnimationFrame', { value: function (fn) { return setTimeout(fn, 0); }, configurable: true });

// Единая загрузка: все модули выполняются в одном контексте без 'use strict',
// чтобы function-декларации становились свойствами globalThis (как <script> в браузере).
const files = [
    'js/core/utils.js',
    'js/state/app-state.js',
    'js/state/active-workout-storage.js',
    'js/state/set-input-drafts.js',
    'js/ui/swipe-delete.js',
];
const vm = require('vm');
const ctx = dom.getInternalVMContext();
vm.runInContext("var USER_ID = 'test';", ctx);
for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').replace(/^'use strict';$/m, '');
    vm.runInContext(src, ctx, { filename: f });
}

// Стабы окружения — как браузерные globals до загрузки приложения
vm.runInContext(`
    if (!window.state) window.state = { activeWorkout: null };
    window.DataAPI = { getProgramById: function(){ return null; } };
    var saveActiveWorkout = function(){ try { localStorage.setItem('twa_fitness_active_workout_test', JSON.stringify(window.state.activeWorkout)); } catch(e){} };
    var haptic = function(){};
    var showAlert = function(m){ window.__alerts = (window.__alerts||[]).concat(m); };
    var showConfirm = function(m, cb){ cb(true); };
    var closeWorkoutContextMenu = function(){};
    var escHtml = function(s){ return String(s); };
    var escAttr = function(s){ return String(s); };
    var startTimer = function(){};
    var stopWorkoutTimer = function(){};
    var clearMainButton = function(){};
    var openProgramsScreen = function(){};
    var navigate = function(){};
    var getSupersetStyle = function(){ return { styleAttr: '', badgeStyle: '' }; };
    var renderWorkout = function(){ document.getElementById('app-content').innerHTML = generateExerciseCardHTML(0, state.activeWorkout.exercises[0]); if (window.bindSwipeZones) bindSwipeZones(); };
`, ctx);
vm.runInContext(fs.readFileSync('js/features/workout/workout.controller.js', 'utf8').replace(/^'use strict';$/m, ''), ctx, { filename: 'workout.controller.js' });

// Состояние: упражнение с тремя подходами 5/10/15 кг
vm.runInContext(`
    state.activeWorkout = { programId:'p', programName:'t', startTime: Date.now(), exercises: [{
        name:'Жим', muscleGroup:'chest', exerciseType:'weighted', supersetId:null,
        targetSets:3, targetReps:10, sets:[
            { id:'set_a', weight:5, reps:10, setType:'regular' },
            { id:'set_b', weight:10, reps:10, setType:'regular' },
            { id:'set_c', weight:15, reps:10, setType:'regular' }
        ] } ] };
    renderWorkout();
`, ctx);

function rows() {
    return Array.from(document.querySelectorAll('#sets-container-0 li.set-line')).map(function (li) {
        return {
            id: li.dataset.setId,
            num: li.querySelector('.set-num').textContent,
            w: li.querySelector('[data-field="weight"]').value,
            r: li.querySelector('[data-field="reps"]').value,
        };
    });
}

function fire(zone, type, x, y, isEnd) {
    const e = new win.Event(type, { bubbles: true, cancelable: true });
    const t = { identifier: 1, target: zone, clientX: x, clientY: y };
    Object.defineProperty(e, 'touches', { value: isEnd ? [] : [t] });
    Object.defineProperty(e, 'changedTouches', { value: [t] });
    // сначала window-capture слушатели модуля, затем зона (target-слушатели)
    try { win.dispatchEvent(e); } catch (err) {}
    try { zone.dispatchEvent(e); } catch (err) {}
}
function ptr(zone, phase, x, y) {
    if (phase === 'pointerdown') fire(zone, 'touchstart', x, y, false);
    else if (phase === 'pointermove') fire(zone, 'touchmove', x, y, false);
    else fire(zone, 'touchend', x, y, true);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async function main() {
    console.log('initial rows:', JSON.stringify(rows()));

    vm.runInContext(`
        window.__origWarn = console.warn;
        const reg = swipeLeftHandlers;
        window.__handlerCalls = [];
        const orig = reg['delete-set'];
        reg['delete-set'] = function(a,p){ window.__handlerCalls.push([a,p]); return orig(a,p); };
        window.__rsCalls = [];
        const ors = removeSet;
        removeSet = function(e,i){ window.__rsCalls.push([e,i]); return ors(e,i); };
        window.__tryAddBlocked = 0;
    `, ctx);
    


vm.runInContext(`
    (function(){
        const origEnd = null;
        // wrap handler registry visibility
        const zone = document.querySelector('#sets-container-0 li[data-set-id="set_b"]');
        window.__zoneB = zone;
        console.log('has pointerdown listeners? bound=', zone.dataset.swipeBound, 'payload=', zone.dataset.payload);
    })();
`, ctx);

    // Свайп-удаление строки set_b (10 кг)
    const zoneB = document.querySelector('#sets-container-0 li[data-set-id="set_b"]');
    ptr(zoneB, 'pointerdown', 200, 100);
    for (let x = 200 - 12; x >= 100; x -= 12) ptr(zoneB, 'pointermove', x, 102);
    console.log('zone.mswipeTracking during gesture:', String(zoneB.mswipeTracking));
    ptr(zoneB, 'pointerup', 100, 102);

    await sleep(700); // glide + collapse + finalize

    const afterSwipeState = vm.runInContext('JSON.stringify(state.activeWorkout.exercises[0].sets.map(s=>[s.id,s.weight]))', ctx);
    console.log('state after swipe:', afterSwipeState);
    console.log('handler calls:', vm.runInContext('JSON.stringify(window.__handlerCalls)', ctx));
    console.log('removeSet calls:', vm.runInContext('JSON.stringify(window.__rsCalls)', ctx));
    console.log('inProgress:', vm.runInContext('String(window.__swipeDeleteInProgress)', ctx));
    console.log('rows after swipe:', JSON.stringify(rows()));

    // Клик «+ Подход»
    vm.runInContext('tryAddSet(0)', ctx);
    await sleep(50);
    const afterAddState = vm.runInContext('JSON.stringify(state.activeWorkout.exercises[0].sets.map(s=>[s.id,s.weight]))', ctx);
    console.log('state after add:', afterAddState);
    console.log('rows after add:', JSON.stringify(rows()));

    const st = vm.runInContext('state.activeWorkout.exercises[0].sets', ctx);
    const hasB = st.some(s => s.id === 'set_b');
    const ghostRows = document.querySelectorAll('#sets-container-0 li:not(.set-line)').length;
    if (!hasB && rows().length === 3 && !ghostRows) {
        console.log('TEST PASS');
        process.exit(0);
    } else {
        console.log('TEST FAIL: set_b resurrected=' + hasB + ', rows=' + rows().length + ', ghosts=' + ghostRows);
        process.exit(1);
    }
})().catch(function (e) { console.error('TEST ERROR', e); process.exit(2); });
