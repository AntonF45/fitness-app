const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<html><body></body></html>', { pretendToBeVisual: true });
const win = dom.window;
win.localStorage = (()=>{const m={};return{setItem:(k,v)=>m[k]=String(v),getItem:k=>k in m?m[k]:null,removeItem:k=>{delete m[k];}};})();
win.PointerEvent = win.MouseEvent;
const ctx = vm.createContext(win);
vm.runInContext(`
showAlert=m=>{}; showConfirm=(m,cb)=>cb(true); haptic=()=>{};
escHtml=s=>String(s); escAttr=s=>String(s);
parseWeight=s=>{const v=parseFloat(String(s).replace(',','.'));return isNaN(v)?null:v;};
parseReps=s=>{const v=parseInt(s,10);return isNaN(v)?null:v;};
adjustWeight=(v,d)=>Math.max(0,v+d); adjustReps=(v,d)=>Math.max(0,v+d);
cancelLongPressOn=()=>{}; DataAPI={getProgramById:()=>null}; navigate=()=>{};
saveActiveWorkout=()=>{}; updateExerciseBadge=()=>{};
`, ctx);
for (const f of ['js/state/set-input-drafts.js','js/ui/swipe-delete.js','js/features/workout/workout.controller.js']) {
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, { filename: f });
}
vm.runInContext(`
state = { activeWorkout: { exercises: [ { name:'Жим', exerciseType:'weighted', targetSets:3, targetReps:10, sets: [] } ] } };
document.body.innerHTML = '<div id="exercise-card-0"><ol id="sets-container-0" class="sets-list"></ol><span id="badge-0"></span></div>';
initSwipeDelete();

const ex = state.activeWorkout.exercises[0];
const ids = [makeSetId(), makeSetId(), makeSetId()];
ex.sets.push({id:ids[0],weight:5,reps:10,setType:'regular'});
ex.sets.push({id:ids[1],weight:10,reps:10,setType:'regular'});
ex.sets.push({id:ids[2],weight:15,reps:10,setType:'regular'});
syncSetsListInPlace(0, ex);

const weights = () => Array.from(document.querySelectorAll('.set-line')).map(r=>r.querySelector('[data-field=weight]').value);
console.log('rows:', weights());

// прямой вызов цепочки удаления (как это делает свайп по завершении анимации)
registerSwipeLeftHandler('delete-set', function(a,p){ /* перезапишем ниже — проверяем реальный обработчик */ });
`, ctx);

// Переопределять обработчик НЕ будем — используем тот, что зарегистрирован в контроллере.
vm.runInContext(`
const zone = document.querySelectorAll('.set-line')[1];
function fire(el,type,x,y){
  const e = new Event(type,{bubbles:true,cancelable:true});
  e.clientX=x; e.clientY=y; e.pointerId=1; e.pointerType='touch'; e.button=0;
  el.dispatchEvent(e);
}
zone.setPointerCapture = function(){};
fire(zone,'pointerdown',300,100);
for(let x=290;x>=140;x-=10) fire(zone,'pointermove',x,102);
fire(zone,'pointerup',140,102);

setTimeout(function(){
  console.log('after swipe state:', ex.sets.map(s=>s.weight));
  console.log('after swipe DOM:', weights());
  tryAddSet(0);
  setTimeout(function(){
    console.log('final state:', ex.sets.map(s=>s.weight));
    console.log('final DOM:', weights());
    const ok = JSON.stringify(ex.sets.map(s=>s.weight))===JSON.stringify([5,15,15]) &&
               JSON.stringify(weights())===JSON.stringify(['5','15','15']);
    console.log(ok?'TEST PASS':'TEST FAIL');
    globalThis.__done = ok;
  },2500);
},3500);
`, ctx);
setTimeout(()=>{ process.exit(ctx.__done?0:1); }, 8000);
