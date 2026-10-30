const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; const d = w.document;

function run(f) {
    try { w.eval(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.error('EVAL FAIL', f, e.message); process.exit(1); }
}

run('js/core/utils.js');
w.eval(fs.readFileSync('js/state/app-state.js', 'utf8').replace('let state', 'var state'));
w.eval("var USER_ID='test';");
run('js/state/active-workout-storage.js');
run('js/state/set-input-drafts.js');
w.eval(`haptic=function(){}; showAlert=function(m){window.__alert=m;}; showConfirm=function(m,cb){cb(true);}; startTimer=function(){}; stopWorkoutTimer=function(){}; clearMainButton=function(){}; navigate=function(){}; DataAPI={getProgramById:function(){return null;}};`);
(function(){ var src = fs.readFileSync('js/ui/swipe-delete.js','utf8'); src = src.replace('const swipeLeftHandlers = {};', 'const swipeLeftHandlers = {}; window.__swipeLeftHandlers = swipeLeftHandlers;'); try { w.eval(src); } catch(e){ console.error('EVAL FAIL swipe', e.message); process.exit(1);} })();
run('js/features/workout/workout.controller.js');
run('js/ui/event-delegation.js');

w.state.activeWorkout = { programId: 'p', programName: 'P', startTime: Date.now(), exercises: [{ name: 'Жим', exerciseType: 'weighted', supersetId: null, targetSets: 3, targetReps: 10, sets: [{ weight: 60, reps: 10, setType: 'regular' }, { weight: 70, reps: 12, setType: 'regular' }, { weight: 0, reps: 10, setType: 'regular' }] }] };
w.renderWorkout();

const list = () => d.getElementById('sets-container-0');
const rows = () => Array.from(list().children);
const badge = () => d.getElementById('badge-0').innerText;
let failed = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok -', msg); };

assert(rows().length === 3, 'initial 3 rows');
assert(badge() === '2/3', 'badge 2/3 initially');

function mkTouch(target, type, x, y) {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] });
    Object.defineProperty(e, 'changedTouches', { value: [{ clientX: x, clientY: y }] });
    target.dispatchEvent(e); return e;
}

// emulate the finalize path of swipe-delete: zone.remove(), then handler(action,payload)
function swipeDeleteRow(idx) {
    const zone = rows()[idx];
    const action = zone.dataset.swipeLeft, payload = zone.dataset.payload;
    zone.remove();
    w.__swipeLeftHandlers[action](action, payload);
}
swipeDeleteRow(1);

setTimeout(() => {
    assert(rows().length === 2, 'after swipe delete: 2 rows in DOM');
    assert(w.state.activeWorkout.exercises[0].sets.length === 2, 'state has 2 sets');
    assert(w.state.activeWorkout.exercises[0].sets[0].weight === 60, 'set0 weight 60 kept');
    assert(w.state.activeWorkout.exercises[0].sets[1].weight === 0, 'old set3 shifted to idx1');
    assert(badge() === '1/3', 'badge recomputed 1/3');
    assert(rows()[1].dataset.payload === '0:1', 'row payloads renumbered');

    const btn = d.querySelector('[data-action="add-set"][data-payload="0"]');
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    setTimeout(() => {
        assert(rows().length === 3, 'after + подход: 3 rows');
        assert(w.state.activeWorkout.exercises[0].sets.length === 3, 'state 3 sets');
        assert(rows().map(r => r.dataset.payload).join(',') === '0:0,0:1,0:2', 'payloads sequential');
        const inp1 = d.getElementById('set-0-1-weight');
        assert(inp1 && inp1.value === '0', 'no ghost 70 restored in row2');

        // uncommitted edit (input/change events suppressed scenario): type into field without events
        d.getElementById('set-0-0-reps').value = '15';
        btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        setTimeout(() => {
            assert(rows().length === 4, 'uncommitted edit committed on add (no alert block)');
            assert(w.state.activeWorkout.exercises[0].sets[0].reps === 15, 'uncommitted reps saved to state');
            assert(d.getElementById('set-0-0-reps').value === '15', 'value preserved through re-render');

            const plus = d.querySelector('[data-action="adjust-set"][data-payload="0:3:weight:2.5"]');
            plus.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
            assert(d.getElementById('set-0-3-weight').value === '2.5', 'step-btn starts from 0 when field empty');

            // second delete of last visible row after re-renders
            swipeDeleteRow(2);
            setTimeout(() => {
                assert(rows().length === 3, 'second swipe delete works after re-renders');
                assert(w.state.activeWorkout.exercises[0].sets.length === 3, 'state still 3 sets (removed the appended one)');
                console.log(failed ? 'TEST FAIL (' + failed + ')' : 'TEST PASS');
                process.exit(failed ? 1 : 0);
            }, 600);
        }, 50);
    }, 50);
}, 600);
