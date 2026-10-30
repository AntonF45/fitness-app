const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<!doctype html><html><body><div id="app-content"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; const d = w.document;
w.localStorage.clear();
w.eval(fs.readFileSync('js/core/utils.js','utf8'));
w.eval(fs.readFileSync('js/state/app-state.js','utf8').replace('let state','var state'));
w.eval(fs.readFileSync('js/state/active-workout-storage.js','utf8'));
w.eval(fs.readFileSync('js/state/set-input-drafts.js','utf8'));
// stubs before controller/delegation/swipe
w.eval(`haptic=function(){}; showAlert=function(m){window.__alert=m;}; showConfirm=function(m,cb){cb(true);}; startTimer=function(){}; stopWorkoutTimer=function(){}; clearMainButton=function(){}; navigate=function(){}; DataAPI={getProgramById:function(){return null;}};`);
w.eval(fs.readFileSync('js/ui/swipe-delete.js','utf8'));
w.eval(fs.readFileSync('js/features/workout/workout.controller.js','utf8'));
w.eval(fs.readFileSync('js/ui/event-delegation.js','utf8'));

w.state.activeWorkout = { programId:'p', programName:'P', startTime:Date.now(), exercises:[{name:'Жим',exerciseType:'weighted',supersetId:null,targetSets:3,targetReps:10,sets:[{weight:60,reps:10,setType:'regular'},{weight:70,reps:12,setType:'regular'},{weight:0,reps:10,setType:'regular'}]}] };
w.renderWorkout();

const list = () => d.getElementById('sets-container-0');
const rows = () => Array.from(list().children);
const badge = () => d.getElementById('badge-0').innerText;
const assert = (cond,msg)=>{ if(!cond){ console.error('FAIL:',msg); process.exitCode=1;} else console.log('ok -',msg); };

assert(rows().length===3,'initial 3 rows');
assert(badge()==='2/3','badge 2/3 initially');

function mkTouch(target,type,x,y){
  const E=w.Event; const e=new E(type,{bubbles:true,cancelable:true});
  Object.defineProperty(e,'touches',{value:[{clientX:x,clientY:y}]});
  Object.defineProperty(e,'changedTouches',{value:[{clientX:x,clientY:y}]});
  target.dispatchEvent(e); return e;
}
// swipe row index 1 (payload 0:1) left
const z = rows()[1];
mkTouch(z,'touchstart',300,100);
mkTouch(w,'touchmove',230,105); // dx=-70 dy=5 -> engaged
mkTouch(z,'touchend',230,105);

setTimeout(()=>{
  // after collapse (~<=340ms safety), handler should have run
}, 500);

setTimeout(()=>{
  assert(rows().length===2,'after swipe delete: 2 rows in DOM');
  assert(w.state.activeWorkout.exercises[0].sets.length===2,'state has 2 sets');
  assert(w.state.activeWorkout.exercises[0].sets[0].weight===60,'set0 weight 60 kept');
  assert(w.state.activeWorkout.exercises[0].sets[1].weight===0,'old set2 shifted to idx1');
  assert(badge()==='1/3','badge recomputed 1/3');
  assert(rows()[1].dataset.payload==='0:1','row payloads renumbered');

  // press "+ Подход" via delegated click
  const btn=d.querySelector('[data-action="add-set"][data-payload="0"]');
  btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  setTimeout(()=>{
    assert(rows().length===3,'after + подход: 3 rows');
    assert(w.state.activeWorkout.exercises[0].sets.length===3,'state 3 sets');
    assert(rows().map(r=>r.dataset.payload).join(',')==='0:0,0:1,0:2','payloads sequential');
    const inp1=d.getElementById('set-0-1-weight');
    assert(inp1 && inp1.value==='0','no ghost 70 restored in row2');
    // typing without change event (input suppressed scenario): type into row0 weight then add set
    d.getElementById('set-0-0-reps').value='15'; // no dispatch of input/change
    btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    setTimeout(()=>{
      assert(rows().length===4,'commitVisibleSetInputs allowed adding after uncommitted edit');
      assert(w.state.activeWorkout.exercises[0].sets[0].reps===15,'uncommitted reps committed to state');
      assert(d.getElementById('set-0-0-reps').value==='15','value preserved through re-render');
      // adjust-set button reads from input: set row3 weight empty->press +2.5
      const plus=d.querySelector('[data-action="adjust-set"][data-payload="0:3:weight:2.5"]');
      plus.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
      assert(d.getElementById('set-0-3-weight').value==='2.5','step-btn starts from 0 when field empty');
      console.log(process.exitCode?'TEST FAIL':'TEST PASS');
    },50);
  },50);
},500);
