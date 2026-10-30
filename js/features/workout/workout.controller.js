/* features/workout/workout.controller.js — экран активной тренировки: подходы, дроп-сеты,
   таймер, старт/завершение сессии. */
'use strict';

// Строка подхода — компактная, в одну линию: номер (ol > li), вес, повторения.
// Удаление подхода — по долгому нажатию на строку (ui/long-press.js → context-set).
function generateSetHTML(exIdx, setIdx, set, exType) {
    const isDrop = set.setType === 'drop';
    const bw = exType === 'bodyweight';
    const noteHTML = set.note ? '<div class="set-note"><i class="fa-solid fa-comment-dots"></i> ' + escHtml(set.note) + '</div>' : '';
    return '<li id="set-row-' + exIdx + '-' + setIdx + '" class="set-line card-enter' + (isDrop ? ' set-drop' : '') + '" data-longpress="context-set" data-payload="' + exIdx + ':' + setIdx + '">' +
        '<div class="set-line-main">' +
            '<span class="set-num">' + (isDrop ? '<i class="fa-solid fa-fire set-num-drop" title="Дроп-подход"></i>' : '') + '</span>' +
            '<div class="flex items-center gap-1 flex-1 min-w-0">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:-2.5" class="step-btn" aria-label="Меньше вес">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-weight" inputmode="decimal" value="' + set.weight + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="weight" class="set-input input-bare w-full h-9 text-center text-base font-semibold min-w-0" aria-label="' + (bw ? 'Доп. вес, кг' : 'Вес, кг') + '">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:2.5" class="step-btn" aria-label="Больше вес">+</button>' +
                '<span class="unit-hint">кг</span>' +
            '</div>' +
            '<div class="flex items-center gap-1 flex-1 min-w-0">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:-1" class="step-btn" aria-label="Меньше повторов">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-reps" inputmode="numeric" value="' + set.reps + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="reps" class="set-input input-bare w-full h-9 text-center text-base font-semibold min-w-0" aria-label="Повторения">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:1" class="step-btn" aria-label="Больше повторов">+</button>' +
                '<span class="unit-hint">повт</span>' +
            '</div>' +
        '</div>' + noteHTML +
    '</li>';
}
function generateExerciseCardHTML(exIdx, ex) {
    const sets = ex.sets || [];
    const completed = sets.filter(function (s) { return s.weight > 0 && s.reps > 0; }).length;
    const target = ex.targetSets ?? 3;
    const isComplete = completed >= target;   // «✓ Готово» — только по числу заполненных подходов
    const hasNotes = sets.some(function (st) { return !!(st && st.note); });
    // Заголовок: название — зона долгого нажатия (контекстное меню: удалить / комментарий).
    // Кнопка «крестик» убрана, удаление упражнения — только через контекст с подтверждением.
    // Отдельная кнопка «Ощущения» убрана: комментарий добавляется тем же долгим нажатием,
    // наличие заметки показывается иконкой в заголовке и под строкой подхода.
    return '<div id="exercise-card-' + exIdx + '" class="app-card mb-4 card-enter">' +
        '<div class="flex justify-between items-center mb-3 gap-2">' +
            '<div class="exercise-header flex items-center gap-2 flex-1 min-w-0 flex-wrap" data-longpress="context-exercise" data-payload="' + exIdx + '">' +
                '<h3 class="font-bold text-sm leading-snug break-words flex-1">' + escHtml(ex.name) + '</h3>' +
                (ex.exerciseType === 'bodyweight' ? '<span class="bodyweight-badge shrink-0">Собственный вес</span>' : '') +
                (hasNotes ? '<i class="fa-solid fa-comment-dots note-indicator shrink-0" title="Есть комментарий"></i>' : '') +
            '</div>' +
            '<span id="badge-' + exIdx + '" class="text-xs font-medium px-2 py-1 rounded-md shrink-0 ' + (isComplete ? 'bg-green-500/20 text-green-500' : 'app-inset text-tgHint') + '">' + (isComplete ? '✓ Готово' : completed + '/' + target) + '</span>' +
        '</div>' +
        '<ol id="sets-container-' + exIdx + '" class="sets-list">' + sets.map(function (s, i) { return generateSetHTML(exIdx, i, s, ex.exerciseType); }).join('') + '</ol>' +
        '<div class="flex gap-2 mt-2 flex-wrap"><button data-action="add-set" data-payload="' + exIdx + '" class="btn btn-sm btn-secondary btn-auto">+ Подход</button><button data-action="add-drop-set" data-payload="' + exIdx + '" class="btn btn-sm btn-warn btn-auto"><i class="fa-solid fa-fire"></i> Дроп-сет</button></div>' +
    '</div>';
}
function updateExerciseCardInDOM(exIdx, ex) { const cardHTML = generateExerciseCardHTML(exIdx, ex); const existing = document.getElementById('exercise-card-' + exIdx); if (existing) existing.outerHTML = cardHTML; }
function updateExerciseBadge(exIdx) { const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null; if (!ex) return; const completed = ex.sets.filter(function (s) { return s.weight > 0 && s.reps > 0; }).length; const target = ex.targetSets ?? 3; const badge = document.getElementById('badge-' + exIdx); if (badge) { badge.className = 'text-xs font-medium px-2 py-1 rounded-md shrink-0 ' + (completed >= target ? 'bg-green-500/20 text-green-500' : 'app-inset text-tgHint'); badge.innerText = completed >= target ? '✓ Готово' : completed + '/' + target; } }
function removeWorkoutExercise(exIdx) { closeWorkoutContextMenu(); showConfirm('Удалить это упражнение из тренировки?', function (ok) { if (ok) { state.activeWorkout.exercises.splice(exIdx, 1); saveActiveWorkout(); haptic('light'); renderWorkout(); } }); }
// Перед добавлением подхода убеждаемся, что последний заполнен; подсказываем про комментарий.
function tryAddSet(exIdx) {
    const sets = state.activeWorkout.exercises[exIdx].sets || [];
    if (sets.length > 0) {
        const last = sets[sets.length - 1];
        if (!last.weight || Number(last.weight) <= 0 || !last.reps || Number(last.reps) <= 0) {
            showAlert(last.note ? 'Предыдущий подход не заполнен (к нему уже есть комментарий)' : 'Заполните предыдущий подход');
            return;
        }
    }
    addSet(exIdx);
}
function tryAddDropSet(exIdx) { const sets = state.activeWorkout.exercises[exIdx].sets || []; if (sets.length === 0) { showAlert('Сначала добавьте обычный подход'); return; } const last = sets[sets.length - 1]; if (!last.weight || Number(last.weight) <= 0 || !last.reps || Number(last.reps) <= 0) { showAlert('Заполните предыдущий подход'); return; } addDropSet(exIdx); }
function renderWorkout() {
    const workout = state.activeWorkout; if (!workout) { openProgramsScreen(); return; }
    const exercises = workout.exercises || [];
    const allSsIds = exercises.map(function (e) { return e.supersetId; });
    const groups = []; const processed = new Set();
    exercises.forEach(function (ex, idx) {
        if (processed.has(idx)) return;
        if (ex.supersetId) {
            const group = exercises.map(function (e, i) { e = Object.assign({}, e); e.originalIndex = i; return e; }).filter(function (e) { return e.supersetId === ex.supersetId; });
            group.forEach(function (e) { processed.add(e.originalIndex); });
            groups.push({ type: 'superset', exercises: group });
        } else { processed.add(idx); groups.push({ type: 'single', exercise: ex, originalIndex: idx }); }
    });
    const groupsHTML = groups.map(function (g, gIdx) {
        if (g.type === 'superset') {
            const style = getSupersetStyle(g.exercises[0].supersetId, allSsIds);
            return '<div class="app-inset p-3 mb-4 card-enter" style="animation-delay: ' + (gIdx * 0.1) + 's; ' + style.styleAttr + '"><div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold mb-3 uppercase tracking-wide" style="' + style.badgeStyle + '"><i class="fa-solid fa-bolt"></i> СУПЕРСЕТ</div>' + g.exercises.map(function (ex) { return generateExerciseCardHTML(ex.originalIndex, ex); }).join('') + '</div>';
        }
        return generateExerciseCardHTML(g.originalIndex, g.exercise);
    }).join('');
    document.getElementById('app-content').innerHTML =
        '<div class="sticky top-0 z-10 bg-tgBg/95 backdrop-blur-md py-4 mb-4 border-b border-tgSecondaryBg card-enter"><div class="text-4xl font-mono font-bold text-tgLink tracking-wider text-center" id="workout-timer">00:00:00</div><div class="text-tgHint text-xs mt-1 uppercase tracking-wide text-center">Время тренировки</div></div>' +
        groupsHTML +
        '<button data-action="add-workout-exercise" class="btn btn-dashed mt-2 mb-2"><i class="fa-solid fa-plus"></i> Добавить упражнение</button>' +
        '<button data-action="finish-workout" class="btn btn-danger mt-2 mb-4"><i class="fa-solid fa-stop"></i> Завершить тренировку</button>';
    startTimer(); clearMainButton();
}
function adjustSet(exIdx, setIdx, field, delta) { const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null; if (!ex) return; const set = ex.sets ? ex.sets[setIdx] : null; if (!set) return; const current = Number(set[field]) || 0; set[field] = field === 'weight' ? adjustWeight(current, delta) : adjustReps(current, delta); saveActiveWorkout(); haptic('light'); const input = document.getElementById('set-' + exIdx + '-' + setIdx + '-' + field); if (input) input.value = set[field]; updateExerciseBadge(exIdx); }
function addSet(exIdx) { const ex = state.activeWorkout.exercises[exIdx]; const sets = ex.sets; let w = 0, r = ex.targetReps ?? 10; if (sets.length > 0) { w = sets[sets.length - 1].weight; r = sets[sets.length - 1].reps; } sets.push({ weight: w, reps: r, setType: 'regular' }); saveActiveWorkout(); haptic('light'); updateExerciseCardInDOM(exIdx, ex); }
function addDropSet(exIdx) { const ex = state.activeWorkout.exercises[exIdx]; const sets = ex.sets; const last = sets[sets.length - 1]; const drop = Math.max(0, Math.round((last.weight * 0.75) / 2.5) * 2.5); sets.push({ weight: drop, reps: last.reps, setType: 'drop' }); saveActiveWorkout(); haptic('medium'); updateExerciseCardInDOM(exIdx, ex); }
// Удаление подхода — только с подтверждением (вызывается из контекстного меню long-press).
function confirmRemoveSet(exIdx, setIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !ex.sets || !ex.sets[setIdx]) return;
    showConfirm('Удалить подход ' + (setIdx + 1) + '?', function (ok) { if (ok) removeSet(exIdx, setIdx); });
}
function removeSet(exIdx, setIdx) { const sets = state.activeWorkout.exercises[exIdx].sets; if (sets.length <= 1) sets[0] = { weight: 0, reps: 10, setType: 'regular' }; else sets.splice(setIdx, 1); saveActiveWorkout(); haptic('light'); updateExerciseCardInDOM(exIdx, state.activeWorkout.exercises[exIdx]); }
function updateSet(exIdx, setIdx, field, value) { state.activeWorkout.exercises[exIdx].sets[setIdx][field] = value; saveActiveWorkout(); }
function startWorkout(programId) { const program = DataAPI.getProgramById(programId); if (!program || !(program.exercises || []).length) { showAlert('Нет упражнений'); return; } state.activeWorkout = { programId: program.id, programName: program.name, startTime: Date.now(), exercises: program.exercises.map(function (ex) { return { name: ex.name, muscleGroup: ex.muscleGroup, exerciseType: ex.exerciseType || 'weighted', supersetId: ex.supersetId || null, targetSets: ex.targetSets, targetReps: ex.targetReps, sets: [{ weight: 0, reps: ex.targetReps || 10, setType: 'regular' }] }; }) }; saveActiveWorkout(); navigate('workout'); }
function startTimer() { stopWorkoutTimer(); const update = function () { if (!state.activeWorkout) return; const elapsed = Math.max(0, Date.now() - state.activeWorkout.startTime); const h = Math.floor(elapsed / 3600000), m = Math.floor((elapsed % 3600000) / 60000), s = Math.floor((elapsed % 60000) / 1000); const el = document.getElementById('workout-timer'); if (el) el.innerText = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }; update(); state.workoutTimer = setInterval(update, 1000); }
function stopWorkoutTimer() { if (state.workoutTimer) { clearInterval(state.workoutTimer); state.workoutTimer = null; } }
function clearWorkoutState() { stopWorkoutTimer(); state.activeWorkout = null; saveActiveWorkout(); clearMainButton(); }
