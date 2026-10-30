/* features/workout/workout.controller.js — экран активной тренировки: подходы, дроп-сеты,
   таймер, старт/завершение сессии. */
'use strict';

function setFieldValue(exIdx, setIdx, field, setData) {
    if (typeof effectiveSetValue === 'function') return escAttr(effectiveSetValue(exIdx, setIdx, field, setData));
    return String(setData);
}

function generateSetHTML(exIdx, setIdx, set, exType) {
    const isDrop = set.setType === 'drop';
    const bw = exType === 'bodyweight';
    const w = setFieldValue(exIdx, setIdx, 'weight', set.weight);
    const r = setFieldValue(exIdx, setIdx, 'reps', set.reps);
    return '<li id="set-row-' + exIdx + '-' + setIdx + '" class="set-line card-enter' + (isDrop ? ' set-drop' : '') + '" data-swipe-left="delete-set" data-payload="' + exIdx + ':' + setIdx + '" data-longpress="context-set">' +
        '<div class="set-swipe-bg"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>' +
        '<div class="set-line-inner">' +
        '<div class="set-line-main">' +
            '<span class="set-num">' + (setIdx + 1) + '</span>' +
            (isDrop ? '<i class="fa-solid fa-fire set-num-drop" title="Дроп-подход"></i>' : '') +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:-2.5" class="step-btn" aria-label="Меньше вес">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-weight" inputmode="decimal" value="' + w + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="weight" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="' + (bw ? 'Доп. вес, кг' : 'Вес, кг') + '">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:2.5" class="step-btn" aria-label="Больше вес">+</button>' +
                '<span class="unit-hint shrink-0">кг</span>' +
            '</div>' +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:-1" class="step-btn" aria-label="Меньше повторов">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-reps" inputmode="numeric" value="' + r + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="reps" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="Повторения">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:1" class="step-btn" aria-label="Больше повторов">+</button>' +
                '<span class="unit-hint shrink-0">повт</span>' +
            '</div>' +
        '</div>' +
        '</div>' +
    '</li>';
}

function generateExerciseCardHTML(exIdx, ex) {
    const sets = ex.sets || [];
    const completed = countCompletedSets(exIdx);
    const target = ex.targetSets ?? 3;
    const isComplete = completed >= target;
    const hasNotes = !!(ex.note && String(ex.note).trim());
    const exNoteHTML = hasNotes ? '<div class="set-note exercise-note mb-3"><i class="fa-solid fa-comment-dots"></i> ' + escHtml(ex.note) + '</div>' : '';
    return '<div id="exercise-card-' + exIdx + '" class="app-card mb-4 card-enter">' +
        '<div class="flex justify-between items-center mb-3 gap-2">' +
            '<div class="exercise-header flex items-center gap-2 flex-1 min-w-0 flex-wrap">' +
                '<h3 class="font-bold text-sm leading-snug break-words flex-1">' + escHtml(ex.name) + '</h3>' +
                (ex.exerciseType === 'bodyweight' ? '<span class="bodyweight-badge shrink-0">Собственный вес</span>' : '') +
                (hasNotes ? '<i class="fa-solid fa-comment-dots note-indicator shrink-0" title="Есть комментарий"></i>' : '') +
            '</div>' +
            '<span id="badge-' + exIdx + '" class="text-xs font-medium px-2 py-1 rounded-md shrink-0 ' + (isComplete ? 'bg-green-500/20 text-green-500' : 'app-inset text-tgHint') + '">' + (isComplete ? '✓ Готово' : completed + '/' + target) + '</span>' +
            '<button data-action="exercise-menu" data-payload="' + exIdx + '" class="menu-btn shrink-0" aria-label="Меню упражнения"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
        '</div>' +
        '<ol id="sets-container-' + exIdx + '" class="sets-list">' + sets.map(function (s, i) { return generateSetHTML(exIdx, i, s, ex.exerciseType); }).join('') + '</ol>' +
        exNoteHTML +
        '<div class="exercise-actions"><button data-action="add-set" data-payload="' + exIdx + '" class="btn btn-sm btn-secondary">+ Подход</button><button data-action="add-drop-set" data-payload="' + exIdx + '" class="btn btn-sm btn-warn"><i class="fa-solid fa-fire"></i> Дроп-сет</button></div>' +
    '</div>';
}

// Синхронизация списка подходов из state — единственный источник истины.
// Строку, удалённую свайпом (zone.remove() до вызова обработчика), здесь уже нет:
// список пересобирается строго по актуальному ex.sets. Возвращает false, если
// контейнера нет в DOM — вызывающий перерисовывает экран.
function syncSetsListInPlace(exIdx, ex) {
    const list = document.getElementById('sets-container-' + exIdx);
    if (!list) return false;

    // Черновики строк создаются заново из state, поэтому фокус/редактирование
    // теряются — сохраняем позицию каретки и восстанавливаем после замены.
    const focusedId = document.activeElement && document.activeElement.id &&
        String(document.activeElement.id).indexOf('set-' + exIdx + '-') === 0 ?
        { id: document.activeElement.id, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } : null;

    const rowsHtml = ex.sets.map(function (s, i) { return generateSetHTML(exIdx, i, s, ex.exerciseType); }).join('');
    if (list.innerHTML !== rowsHtml) list.innerHTML = rowsHtml;

    if (focusedId) {
        const el = document.getElementById(focusedId);
        if (el) { try { el.focus({ preventScroll: true }); el.setSelectionRange(focusedId.start, focusedId.end); } catch (err) {} }
    }
    if (typeof applySetDraftsToInputs === 'function') applySetDraftsToInputs(exIdx);
    return true;
}

function updateExerciseCardInDOM(exIdx, ex) {
    const card = document.getElementById('exercise-card-' + exIdx);
    if (!card) { renderWorkout(); return; }
    syncSetsListInPlace(exIdx, ex);
    updateExerciseBadge(exIdx);
}

// Badge считает заполненные подходы по значениям полей ввода (реестр черновиков) с откатом на state.
function countCompletedSets(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !ex.sets) return 0;
    let completed = 0;
    for (let i = 0; i < ex.sets.length; i++) {
        const w = Number(effectiveSetValue(exIdx, i, 'weight', ex.sets[i].weight));
        const r = Number(effectiveSetValue(exIdx, i, 'reps', ex.sets[i].reps));
        if (w > 0 && r > 0) completed++;
    }
    return completed;
}

function updateExerciseBadge(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const completed = countCompletedSets(exIdx);
    const target = ex.targetSets ?? 3;
    const badge = document.getElementById('badge-' + exIdx);
    if (!badge) return;
    badge.className = 'text-xs font-medium px-2 py-1 rounded-md shrink-0 ' + (completed >= target ? 'bg-green-500/20 text-green-500' : 'app-inset text-tgHint');
    badge.innerText = completed >= target ? '✓ Готово' : completed + '/' + target;
}

function removeWorkoutExercise(exIdx) {
    closeWorkoutContextMenu();
    showConfirm('Удалить это упражнение из тренировки?', function (ok) {
        if (!ok) return;
        if (typeof clearSetDraftsForExercise === 'function') clearSetDraftsForExercise(exIdx);
        state.activeWorkout.exercises.splice(exIdx, 1);
        saveActiveWorkout(); haptic('light'); renderWorkout();
    });
}

// Новый подход наследует вес/повторы последнего и попадает в черновики.
function seedNewSetDrafts(exIdx, setIdx, set) {
    if (typeof saveSetDraft !== 'function') return;
    ['weight', 'reps'].forEach(function (f) {
        const v = set[f];
        if (v !== 0 && v !== null && typeof v !== 'undefined') saveSetDraft(exIdx, setIdx, f, String(v));
    });
}

// Перед изменением состояния переносим все незакрытые значения полей ввода в state
// (input-событие в Telegram WebView может не доходить до обработчика).
function commitVisibleSetInputs(exIdx) {
    const inputs = document.querySelectorAll('[data-exercise="' + exIdx + '"].set-input');
    for (let i = 0; i < inputs.length; i++) {
        const t = inputs[i];
        const setIdx = parseInt(t.dataset.set, 10), field = t.dataset.field;
        const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
        const set = ex && ex.sets ? ex.sets[setIdx] : null;
        if (!set || isNaN(setIdx)) continue;
        const raw = String(t.value);
        if (raw.trim() === '') continue;
        const value = field === 'weight' ? parseWeight(raw) : parseReps(raw);
        if (value === null) continue;
        if (String(value) !== String(set[field])) set[field] = value;
        if (typeof saveSetDraft === 'function') saveSetDraft(exIdx, setIdx, field, String(value));
    }
    if (state.activeWorkout) saveActiveWorkout();
}

function tryAddSet(exIdx) {
    commitVisibleSetInputs(exIdx);
    const sets = state.activeWorkout.exercises[exIdx].sets || [];
    if (sets.length > 0) {
        const last = sets[sets.length - 1];
        if (!last.weight || Number(last.weight) <= 0 || !last.reps || Number(last.reps) <= 0) {
            showAlert('Заполните предыдущий подход');
            updateExerciseBadge(exIdx);
            return;
        }
    }
    addSet(exIdx);
}

function tryAddDropSet(exIdx) {
    commitVisibleSetInputs(exIdx);
    const sets = state.activeWorkout.exercises[exIdx].sets || [];
    if (sets.length === 0) { showAlert('Сначала добавьте обычный подход'); return; }
    const last = sets[sets.length - 1];
    if (!last.weight || Number(last.weight) <= 0 || !last.reps || Number(last.reps) <= 0) {
        showAlert('Заполните предыдущий подход'); updateExerciseBadge(exIdx); return;
    }
    addDropSet(exIdx);
}

function renderWorkout() {
    const workout = state.activeWorkout;
    if (!workout) { openProgramsScreen(); return; }
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
    if (typeof window.bindSwipeZones === 'function') window.bindSwipeZones();
}

function adjustSet(exIdx, setIdx, field, delta) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const set = ex.sets ? ex.sets[setIdx] : null;
    if (!set) return;
    // Текущее значение берём из поля ввода: в Telegram WebView событие input
    // может не доходить до обработчика, и state остаётся устаревшим.
    const input = document.getElementById('set-' + exIdx + '-' + setIdx + '-' + field);
    let current = 0;
    if (input && String(input.value).trim() !== '') {
        const parsed = field === 'weight' ? parseWeight(String(input.value)) : parseReps(String(input.value));
        current = parsed === null ? 0 : parsed;
    } else {
        current = Number(effectiveSetValue(exIdx, setIdx, field, set[field])) || 0;
    }
    set[field] = field === 'weight' ? adjustWeight(current, delta) : adjustReps(current, delta);
    saveActiveWorkout(); haptic('light');
    if (typeof saveSetDraft === 'function') saveSetDraft(exIdx, setIdx, field, String(set[field]));
    if (input) input.value = set[field];
    updateExerciseBadge(exIdx);
}

function addSet(exIdx) {
    const ex = state.activeWorkout.exercises[exIdx];
    const sets = ex.sets;
    let w = 0, r = ex.targetReps ?? 10;
    if (sets.length > 0) { w = sets[sets.length - 1].weight; r = sets[sets.length - 1].reps; }
    const created = { weight: w, reps: r, setType: 'regular' };
    sets.push(created);
    seedNewSetDrafts(exIdx, sets.length - 1, created);
    saveActiveWorkout(); haptic('light');
    updateExerciseCardInDOM(exIdx, ex);
}

function addDropSet(exIdx) {
    const ex = state.activeWorkout.exercises[exIdx];
    const sets = ex.sets;
    const last = sets[sets.length - 1];
    const drop = Math.max(0, Math.round((last.weight * 0.75) / 2.5) * 2.5);
    const created = { weight: drop, reps: last.reps, setType: 'drop' };
    sets.push(created);
    seedNewSetDrafts(exIdx, sets.length - 1, created);
    saveActiveWorkout(); haptic('medium');
    updateExerciseCardInDOM(exIdx, ex);
}

function confirmRemoveSet(exIdx, setIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !ex.sets || !ex.sets[setIdx]) return;
    showConfirm('Удалить подход ' + (setIdx + 1) + '?', function (ok) { if (ok) removeSet(exIdx, setIdx); });
}

// Единственный путь удаления подхода: изменяем state, затем пересобираем список.
function removeSet(exIdx, setIdx) {
    commitVisibleSetInputs(exIdx);
    const ex = state.activeWorkout.exercises[exIdx];
    const sets = ex.sets;
    if (sets.length <= 1) sets[0] = { weight: 0, reps: ex.targetReps ?? 10, setType: 'regular' };
    else sets.splice(setIdx, 1);
    if (typeof clearSetDraftsForExercise === 'function') clearSetDraftsForExercise(exIdx);
    sets.forEach(function (s, i) { seedNewSetDrafts(exIdx, i, s); });
    saveActiveWorkout(); haptic('light');
    updateExerciseCardInDOM(exIdx, ex);
}

registerSwipeLeftHandler('delete-set', function (action, payload) {
    const p = String(payload).split(':');
    const exIdx = parseInt(p[0], 10), setIdx = parseInt(p[1], 10);
    if (isNaN(exIdx) || isNaN(setIdx)) return;
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !ex.sets || !ex.sets[setIdx]) return;
    removeSet(exIdx, setIdx);
});

function updateSet(exIdx, setIdx, field, value) { state.activeWorkout.exercises[exIdx].sets[setIdx][field] = value; saveActiveWorkout(); }
function startWorkout(programId) { const program = DataAPI.getProgramById(programId); if (!program || !(program.exercises || []).length) { showAlert('Нет упражнений'); return; } state.activeWorkout = { programId: program.id, programName: program.name, startTime: Date.now(), exercises: program.exercises.map(function (ex) { return { name: ex.name, muscleGroup: ex.muscleGroup, exerciseType: ex.exerciseType || 'weighted', supersetId: ex.supersetId || null, targetSets: ex.targetSets, targetReps: ex.targetReps, sets: [{ weight: 0, reps: ex.targetReps || 10, setType: 'regular' }] }; }) }; saveActiveWorkout(); navigate('workout'); }
function startTimer() { stopWorkoutTimer(); const update = function () { if (!state.activeWorkout) return; const elapsed = Math.max(0, Date.now() - state.activeWorkout.startTime); const h = Math.floor(elapsed / 3600000), m = Math.floor((elapsed % 3600000) / 60000), s = Math.floor((elapsed % 60000) / 1000); const el = document.getElementById('workout-timer'); if (el) el.innerText = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }; update(); state.workoutTimer = setInterval(update, 1000); }
function stopWorkoutTimer() { if (state.workoutTimer) { clearInterval(state.workoutTimer); state.workoutTimer = null; } }
function clearWorkoutState() { stopWorkoutTimer(); state.activeWorkout = null; if (typeof clearAllSetDrafts === 'function') clearAllSetDrafts(); saveActiveWorkout(); clearMainButton(); }
