const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { pretendToBeVisual: true });
const state = { activeWorkout: null };

global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.MutationObserver = dom.window.MutationObserver;
global.state = state;
global.escAttr = (v) => String(v);
global.escHtml = (v) => String(v);
global.saveActiveWorkout = () => {};
global.haptic = () => {};
global.showAlert = (m) => { throw new Error('alert: ' + m); };
global.showConfirm = (m, cb) => cb(true);
global.navigate = () => {};
global.renderWorkout = () => {};
global.clearMainButton = () => {};
global.startTimer = () => {};
global.stopWorkoutTimer = () => {};
global.parseWeight = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) || n < 0 ? null : n; };
global.parseReps = (v) => { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? null : n; };
global.adjustWeight = (c, d) => Math.max(0, c + d);
global.adjustReps = (c, d) => Math.max(0, c + d);
global.getSupersetStyle = () => ({ styleAttr: '', badgeStyle: '' });
global.DataAPI = { getProgramById: () => null };
global.openProgramsScreen = () => {};
global.closeWorkoutContextMenu = () => {};
global.cancelLongPress = () => {};
global.registerLongPressHandler = () => {};
global.formatSetSummary = () => '';
global.openWorkoutContextMenu = () => {};

const fs = require('fs');
const sources = ['js/state/set-input-drafts.js', 'js/ui/swipe-delete.js', 'js/features/workout/workout.controller.js']
    .map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
// one eval at top level of this module scope? No — use indirect eval into globalThis so function decls are global
(0, eval)(sources.replace(/^'use strict';$/gm, ''));

state.activeWorkout = { programId: 'p', programName: 't', startTime: Date.now(), exercises: [
  { name: 'Жим', exerciseType: 'weighted', targetSets: 3, targetReps: 10, sets: [
    { id: 'set_a', weight: 60, reps: 10, setType: 'regular' },
    { id: 'set_b', weight: 60, reps: 10, setType: 'regular' },
    { id: 'set_c', weight: 60, reps: 10, setType: 'regular' }
  ]}
]};
const ex = state.activeWorkout.exercises[0];
document.getElementById('app-content').innerHTML = generateExerciseCardHTML(0, ex);
window.bindSwipeZones();

let failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };

assert(document.querySelectorAll('#sets-container-0 li').length === 3, '3 rows initially');

removeSet(0, 'set_b');
let rows = document.querySelectorAll('#sets-container-0 li');
assert(rows.length === 2, 'after delete 2 rows, got ' + rows.length);
assert(ex.sets.map(s => s.id).join(',') === 'set_a,set_c', 'state has a,c');
assert(rows[0].dataset.setId === 'set_a' && rows[1].dataset.setId === 'set_c', 'DOM ids match');
assert(rows[1].querySelector('.set-num').textContent === '2', 'renumbered to 2');

updateExerciseBadge(0);
assert(document.getElementById('badge-0').innerText === '2/3', 'badge 2/3, got ' + document.getElementById('badge-0').innerText);

tryAddSet(0);
assert(ex.sets.length === 3, '3 sets after add, got ' + ex.sets.length);
assert(!ex.sets.some(s => s.id === 'set_b'), 'set_b not resurrected');
const newId = ex.sets[2].id;
assert(/^set_/.test(newId), 'new set has stable id');
let rows2 = document.querySelectorAll('#sets-container-0 li');
assert(rows2.length === 3 && rows2[2].dataset.setId === newId, 'DOM shows new row last');

// draft keyed by set id: edit set_c input via DOM, delete another set, value must survive
const cWeightInput = document.getElementById('set-set_c-weight');
cWeightInput.value = '75';
window.__testAlerts = [];
tryAddSet(0); // triggers commitVisibleSetInputs first
assert(ex.sets.find(s => s.id === 'set_c').weight === 75, 'commit writes to correct set by id');
removeSet(0, 'set_a');
assert(getSetDraft('set_c', 'weight') === '75', 'draft survives other deletion');
assert(document.getElementById('set-set_c-weight').value === '75', 'input keeps edited value after sibling deletion');
updateExerciseBadge(0);
assert(document.getElementById('badge-0').innerText === 'Готово!', 'all three sets filled -> Готово, got ' + document.getElementById('badge-0').innerText);

const ids = ex.sets.map(s => s.id);
removeSet(0, ids[1]);
removeSet(0, ids[0]);
assert(ex.sets.length === 1 && ex.sets[0].weight === 0 && ex.sets[0].reps === 0, 'last removal leaves one empty set, got ' + JSON.stringify(ex.sets));
assert(document.querySelectorAll('#sets-container-0 li').length === 1, 'one row in DOM');
updateExerciseBadge(0);
assert(document.getElementById('badge-0').innerText === '0/3', 'badge back to 0/3, got ' + document.getElementById('badge-0').innerText);

showAlert = (m) => { failures.__alert = true; };
tryAddSet(0);
assert(failures.__alert, 'add blocked when prev set empty');

console.log(failures.length ? 'FAIL:\n' + failures.join('\n') : 'TEST PASS');
process.exit(failures.length ? 1 : 0);
