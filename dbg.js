const fs=require('fs'),vm=require('vm');
const {JSDOM}=require('jsdom');
const dom=new JSDOM("<html><body></body></html>",{pretendToBeVisual:true});
win.PointerEvent = win.MouseEvent;
const win=dom.window;
win.localStorage=(()=>{const m={};return{setItem:(k,v)=>m[k]=String(v),getItem:k=>k in m?m[k]:null,removeItem:k=>{delete m[k];}};})();
win.PointerEvent = win.MouseEvent;
const ctx=vm.createContext(win);
vm.runInContext(`showAlert=m=>{}; showConfirm=(m,cb)=>cb(true); haptic=()=>{};
escHtml=s=>String(s); escAttr=s=>String(s);
parseWeight=s=>{const v=parseFloat(String(s));return isNaN(v)?null:v;};
parseReps=s=>{const v=parseInt(s,10);return isNaN(v)?null:v;};
cancelLongPressOn=()=>{}; DataAPI={getProgramById:()=>null}; navigate=()=>{};
saveActiveWorkout=()=>{}; updateExerciseBadge=()=>{};`,ctx);
for(const f of ['js/state/set-input-drafts.js','js/ui/swipe-delete.js','js/features/workout/workout.controller.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
vm.runInContext(`
state={activeWorkout:{exercises:[{name:'Жим',exerciseType:'weighted',targetSets:3,targetReps:10,sets:[]}]}};
document.body.innerHTML='<div id="exercise-card-0"><ol id="sets-container-0"></ol></div>';
initSwipeDelete();
const ex=state.activeWorkout.exercises[0];
const ids=[makeSetId(),makeSetId(),makeSetId()];
ex.sets.push({id:ids[0],weight:5,reps:10,setType:'regular'});
ex.sets.push({id:ids[1],weight:10,reps:10,setType:'regular'});
ex.sets.push({id:ids[2],weight:15,reps:10,setType:'regular'});
syncSetsListInPlace(0,ex);
const zone=document.querySelectorAll('.set-line')[1];
console.log('payload:',zone.dataset.payload,'bound:',zone.dataset.swipeBound);

// trace handler invocation
const origH = swipeLeftHandlers['delete-set'];
swipeLeftHandlers['delete-set']=function(a,p){ console.log('HANDLER CALLED', a, p); origH(a,p); };

function fire(el,type,x,y){const e=new Event(type,{bubbles:true,cancelable:true});
e.clientX=x;e.clientY=y;e.pointerId=1;e.pointerType='touch';e.button=0;el.dispatchEvent(e);}
zone.setPointerCapture=function(){};
fire(zone,'pointerdown',300,100);
for(let x=290;x>=140;x-=10) fire(zone,'pointermove',x,102);
fire(zone,'pointerup',140,102);
console.log('after up: removed?', 'tracking=', zone.mswipeTracking);
setTimeout(()=>{
  console.log('t+100 state:',ex.sets.map(s=>s.weight),'ghosts:',document.querySelectorAll('.set-ghost').length,'dead:',document.querySelectorAll('.set-line').length);
},100);
setTimeout(()=>{
  console.log('t+3500 state:',ex.sets.map(s=>s.weight),'DOM rows:',Array.from(document.querySelectorAll('.set-line')).map(r=>r.querySelector('[data-field=weight]').value),'ghosts:',document.querySelectorAll('.set-ghost').length);
  process.exit(0);
},3500);
`,ctx);
