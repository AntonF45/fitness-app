const { JSDOM } = require('jsdom');
const fs = require('fs');
const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>');
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator;

// stubs
const state = { activeWorkout: null };
global.state = state;
global.saveActiveWorkout = function(){};
global.haptic = function(){};
global.showAlert = function(){};
global.escHtml = function(s){ return String(s); };
global.registerSwipeLeftHandler = function(){};
global.startTimer = function(){};
global.clearMainButton = function(){};
global.navigate = function(){};
global.openProgramsScreen = function(){};
global.DataAPI = {};
global.getSupersetStyle = function(){ return {styleAttr:'',badgeStyle:''}; };
global.renderWorkout = function(){};

const src = fs.readFileSync('js/features/workout/workout.controller.js','utf8');
// eval in this context (functions become global-ish via indirect eval? use new Function with exports)
const fn = new Function('exports', src + '\nObject.assign(exports,{generateSetHTML,generateExerciseCardHTML,syncSetsListInPlace,updateExerciseCardInDOM,updateExerciseBadge,addSet,removeSet,tryAddSet});');
const api = {};
fn(api);

// Build DOM: exercise with 3 sets, all filled => badge Готово (target 3)
state.activeWorkout = { exercises: [ { name:'Жим', exerciseType:'weighted', targetSets:3, targetReps:10,
  sets:[{weight:60,reps:10,setType:'regular'},{weight:70,reps:8,setType:'regular'},{weight:80,reps:6,setType:'regular'}] } ] };
document.getElementById('app-content').innerHTML = api.generateExerciseCardHTML(0, state.activeWorkout.exercises[0]);

function rows(){ return Array.from(document.querySelectorAll('#sets-container-0 li')).map(li=>li.dataset.payload); }
function badge(){ return document.getElementById('badge-0').innerText; }

console.log('rows before:', rows(), 'badge:', badge());

// Simulate swipe removal of row idx1 (payload 0:1): mark removing + detach like finalize does
const zone = document.getElementById('set-row-0-1');
zone.swipeAnimating = true; zone.dataset.swipeRemoving='1';
// finalize(): remove node, clear flags, then handler -> removeSet
zone.remove(); zone.swipeAnimating=false; delete zone.dataset.swipeRemoving;
api.removeSet(0,1);
console.log('data after remove:', JSON.stringify(state.activeWorkout.exercises[0].sets.map(s=>s.weight)));
console.log('rows after remove:', rows(), 'badge:', badge());
if (rows().join(',') !== '0:0,0:1') throw new Error('FAIL rows after remove');
if (badge() !== '2/3') throw new Error('FAIL badge should be 2/3, got '+badge());

// Now press "+ Подход" — addSet appends new empty row (copies weight/reps from last set)
api.addSet(0);
console.log('rows after add:', rows(), 'badge:', badge());
if (rows().join(',') !== '0:0,0:1,0:2') throw new Error('FAIL rows after add');
if (badge() !== '2/3') throw new Error('FAIL badge after add (new set empty -> still 2/3), got '+badge());
const w2 = document.getElementById('set-0-2-weight').value;
if (w2 !== '80') throw new Error('FAIL new row value, got '+w2);

// Test uncommitted draft carry: user typed "100" into row 0 weight but no change event fired
document.getElementById('set-0-0-weight').value = '100';
// delete middle row again (now 3 sets: 60,80,80(empty)). removeSet(0,1) removes 80
const z = document.getElementById('set-row-0-1');
z.swipeAnimating=true; z.dataset.swipeRemoving='1'; z.remove(); z.swipeAnimating=false; delete z.dataset.swipeRemoving;
api.removeSet(0,1);
console.log('rows:', rows(), 'row0 weight input:', document.getElementById('set-0-0-weight').value);
if (document.getElementById('set-0-0-weight').value !== '100') throw new Error('FAIL draft not carried');
console.log('TEST PASS');
