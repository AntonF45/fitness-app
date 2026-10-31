const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;

function addScript(src) {
  const el = w.document.createElement('script');
  el.textContent = src;
  w.document.body.appendChild(el);
}

// stubs in window scope (like real app globals)
w.eval(`
var escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
var escAttr = s => String(s);
var haptic = function(){}; var showAlert = function(){}; var showConfirm = function(){};
var parseWeight = v => { const n = parseFloat(String(v).replace(',','.')); return isNaN(n) ? null : n; };
var parseReps = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
var adjustWeight = (c,d) => Math.max(0, c+d);
var adjustReps = (c,d) => Math.max(0, c+d);
var getSupersetStyle = () => ({ styleAttr: '', badgeStyle: '' });
var navigate = function(){}; var openProgramsScreen = function(){}; var clearMainButton = function(){};
var cancelLongPress = function(){};
var state = { activeWorkout: null, workoutTimer: null };
var USER_ID = 'test';
`);

['js/state/set-input-drafts.js',
 'js/state/active-workout-storage.js',
 'js/ui/swipe-delete.js'].forEach(f => {
  addScript(fs.readFileSync(f, 'utf8'));
});
const ctrl = fs.readFileSync('js/features/workout/workout.controller.js', 'utf8')
  .replace(/function startTimer\(\)[\s\S]*$/, '');
addScript(ctrl); if (typeof w.removeSet !== 'function') { console.log('controller failed to load'); process.exit(1); }

w.eval(`
state.activeWorkout = { programId:'p', programName:'t', startTime:Date.now(), exercises: [
  { name:'Жим', muscleGroup:'chest', exerciseType:'weighted', targetSets:3, targetReps:10, sets:[
    { id:'A', weight:60, reps:10, setType:'regular' },
    { id:'B', weight:70, reps:8,  setType:'regular' },
    { id:'C', weight:80, reps:6,  setType:'regular' } ] } ] };
saveActiveWorkout();
renderWorkout();
`);

const doc = w.document;
const list = doc.getElementById('sets-container-0');
console.log('rows initially:', list.querySelectorAll('.set-line').length);

// emulate swipe module on set B: mark dead, then handler after animation
w.eval(`
var zoneB = document.getElementById('set-row-B');
zoneB.mswipeDead = true; zoneB.style.display = 'none';
window.__swipeDeleteInProgress = Date.now();
removeSet(0, 'B');
window.__swipeDeleteInProgress = 0;
`);
console.log('after remove rows:', list.querySelectorAll('.set-line:not(.set-ghost)').length);
console.log('state ids:', w.state.activeWorkout.exercises[0].sets.map(s=>s.id).join(','));

// KEY TEST: press "+Подход"
w.eval('tryAddSet(0);');
const idsAfterAdd = w.state.activeWorkout.exercises[0].sets.map(s=>s.id).join(',');
const rowIds = Array.from(list.querySelectorAll('.set-line')).map(r=>r.dataset.setId).join(',');
console.log('after addSet state ids:', idsAfterAdd);
console.log('after addSet DOM ids:', rowIds);
if (!idsAfterAdd.includes('B') && !rowIds.includes('B')) console.log('TEST PASS: удалённый подход не вернулся');
else { console.log('TEST FAIL'); process.exit(1); }

// localStorage consistency
const saved = JSON.parse(w.localStorage.getItem('twa_fitness_active_workout_test'));
const savedIds = saved.exercises[0].sets.map(s=>s.id).join(',');
console.log('saved ids:', savedIds);
if (savedIds === idsAfterAdd) console.log('STORAGE PASS'); else { console.log('STORAGE FAIL'); process.exit(1); }

// restore-from-storage scenario: fresh state from localStorage, render again
w.eval(`
state.activeWorkout = null;
restoreActiveWorkout();
renderWorkout();
`);
const list2 = doc.getElementById('sets-container-0');
const rowIds2 = Array.from(list2.querySelectorAll('.set-line')).map(r=>r.dataset.setId).join(',');
console.log('after restore DOM ids:', rowIds2);
if (!rowIds2.includes('B')) console.log('RESTORE PASS'); else { console.log('RESTORE FAIL'); process.exit(1); }

console.log('badge:', doc.getElementById('badge-0').innerText);
