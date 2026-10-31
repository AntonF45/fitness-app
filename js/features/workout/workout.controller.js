/* features/workout/workout.controller.js — экран активной тренировки: подходы, дроп-сеты,
   таймер, старт/завершение сессии. */
'use strict';

function makeSetId() {
    return 'set_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// Подход всегда имеет стабильный id: индекс — только позиция для нумерации.
function ensureSetIds(ex) {
    (ex.sets || []).forEach(function (s) { if (!s.id) s.id = makeSetId(); });
}

function findSetById(ex, setId) {
    if (!ex || !Array.isArray(ex.sets)) return null;
    for (let i = 0; i < ex.sets.length; i++) if (ex.sets[i].id === setId) return ex.sets[i];
    return null;
}

function setFieldValue(setId, field, setData) {
    if (typeof effectiveSetValue === 'function') return escAttr(effectiveSetValue(setId, field, setData));
    return String(setData);
}

function generateSetHTML(exIdx, setIdx, set, exType) {
    const isDrop = set.setType === 'drop';
    const bw = exType === 'bodyweight';
    const sid = set.id;
    const w = setFieldValue(sid, 'weight', set.weight);
    const r = setFieldValue(sid, 'reps', set.reps);
    return '<li id="set-row-' + sid + '" class="set-line card-enter' + (isDrop ? ' set-drop' : '') + '" data-set-id="' + sid + '" data-longpress="context-set">' +
        '<div class="set-line-inner">' +
        '<div class="set-line-main">' +
            '<span class="set-num">' + (setIdx + 1) + '</span>' +
            (isDrop ? '<i class="fa-solid fa-fire set-num-drop" title="Дроп-подход"></i>' : '') +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + sid + ':weight:-2.5" class="step-btn" aria-label="Меньше вес">−</button>' +
                '<input type="number" id="set-' + sid + '-weight" inputmode="decimal" value="' + w + '" data-exercise="' + exIdx + '" data-set-id="' + sid + '" data-field="weight" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="' + (bw ? 'Доп. вес, кг' : 'Вес, кг') + '">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + sid + ':weight:2.5" class="step-btn" aria-label="Больше вес">+</button>' +
                '<span class="unit-hint shrink-0">кг</span>' +
            '</div>' +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + sid + ':reps:-1" class="step-btn" aria-label="Меньше повторов">−</button>' +
                '<input type="number" id="set-' + sid + '-reps" inputmode="numeric" value="' + r + '" data-exercise="' + exIdx + '" data-set-id="' + sid + '" data-field="reps" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="Повторения">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + sid + ':reps:1" class="step-btn" aria-label="Больше повторов">+</button>' +
                '<span class="unit-hint shrink-0">повт</span>' +
            '</div>' +
            '<button data-action="remove-set" data-payload="' + exIdx + ':' + sid + '" class="set-del-btn" aria-label="Удалить подход"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '</div>' +
    '</li>';
}

function generateExerciseCardHTML(exIdx, ex) {
    ensureSetIds(ex);
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

// Синхронизация списка подходов из state — единственного источника истины.
// Полный rebuild контейнера из ex.sets: ни одна строка не может остаться или
// «вернуться» помимо state. Переиспользование старых узлов невозможно, потому
// что узлы хранят id подхода в замыканиях обработчиков свайпа: после splice()
// переиспользованный узел удалял бы не тот подход.
// Возвращает false, если контейнера нет в DOM — вызывающий перерисовывает экран.
function syncSetsListInPlace(exIdx, ex) {
    const list = document.getElementById('sets-container-' + exIdx);
    if (!list) return false;

    ensureSetIds(ex);
    list.innerHTML = ex.sets.map(function (st, i) {
        return generateSetHTML(exIdx, i, st, ex.exerciseType);
    }).join('');

    return true;
}

function updateExerciseCardInDOM(exIdx, ex) {
    const card = document.getElementById('exercise-card-' + exIdx);
    if (!card) { renderWorkout(); return; }
    syncSetsListInPlace(exIdx, ex);
    updateExerciseBadge(exIdx);
}

// Badge считает заполненные подходы из state; черновик поля (введено в поле, но
// ещё не подтверждено) учитывается только когда он НЕ пустой.
function countCompletedSets(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !ex.sets) return 0;
    let completed = 0;
    for (let i = 0; i < ex.sets.length; i++) {
        const sid = ex.sets[i].id;
        const w = Number(getSetDraft(sid, 'weight') ?? ex.sets[i].weight);
        const r = Number(getSetDraft(sid, 'reps') ?? ex.sets[i].reps);
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
        (state.activeWorkout.exercises[exIdx].sets || []).forEach(function (st) {
            if (typeof saveSetDraft === 'function') { saveSetDraft(st.id, 'weight', ''); saveSetDraft(st.id, 'reps', ''); }
        });
        state.activeWorkout.exercises.splice(exIdx, 1);
        saveActiveWorkout(); haptic('light'); renderWorkout();
    });
}

function seedSetDraft(set) {
    if (typeof saveSetDraft !== 'function') return;
    ['weight', 'reps'].forEach(function (f) {
        const v = set[f];
        if (v !== 0 && v !== null && typeof v !== 'undefined') saveSetDraft(set.id, f, String(v));
    });
}

// Перед изменением состояния переносим незакрытые значения полей ввода в state.
// Идентификация — по стабильному data-set-id (не по позиции). Ghost-копии
// свайпа класса не имеют; строки, уже удалённые из state, игнорируются.
function commitVisibleSetInputs(exIdx) {
    const list = document.getElementById('sets-container-' + exIdx);
    if (!list) return;
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !Array.isArray(ex.sets)) return;
    let changed = false;
    const inputs = list.querySelectorAll('.set-input');
    for (let i = 0; i < inputs.length; i++) {
        try {
            const t = inputs[i];
            const set = findSetById(ex, t.dataset.setId);
            if (!set) continue;
            const field = t.dataset.field;
            if (!field) continue;
            const raw = String(t.value);
            if (raw.trim() === '') continue;
            const value = field === 'weight' ? parseWeight(raw) : parseReps(raw);
            if (value === null) continue;
            if (String(value) !== String(set[field])) { set[field] = value; changed = true; }
            if (typeof saveSetDraft === 'function') saveSetDraft(set.id, field, String(value));
        } catch (err) {}
    }
    if (changed && state.activeWorkout) saveActiveWorkout();
}

function tryAddSet(exIdx) {
    commitVisibleSetInputs(exIdx);
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const sets = ex.sets || [];
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
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const sets = ex.sets || [];
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
}

function adjustSet(exIdx, setId, field, delta) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const set = findSetById(ex, setId);
    if (!set) return;
    // Текущее значение берём из поля ввода: в Telegram WebView событие input
    // может не доходить до обработчика, и state остаётся устаревшим.
    const input = document.getElementById('set-' + setId + '-' + field);
    let current = 0;
    if (input && String(input.value).trim() !== '') {
        const parsed = field === 'weight' ? parseWeight(String(input.value)) : parseReps(String(input.value));
        current = parsed === null ? 0 : parsed;
    } else {
        current = Number(effectiveSetValue(setId, field, set[field])) || 0;
    }
    set[field] = field === 'weight' ? adjustWeight(current, delta) : adjustReps(current, delta);
    saveActiveWorkout(); haptic('light');
    if (typeof saveSetDraft === 'function') saveSetDraft(setId, field, String(set[field]));
    if (input) input.value = set[field];
    updateExerciseBadge(exIdx);
}

function addSet(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const sets = ex.sets || (ex.sets = []);
    ensureSetIds(ex);
    let w = 0, r = ex.targetReps ?? 10;
    if (sets.length > 0) { w = sets[sets.length - 1].weight; r = sets[sets.length - 1].reps; }
    const created = { id: makeSetId(), weight: w, reps: r, setType: 'regular' };
    sets.push(created);
    seedSetDraft(created);
    saveActiveWorkout(); haptic('light');
    updateExerciseCardInDOM(exIdx, ex);
}

function addDropSet(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    const sets = ex.sets || (ex.sets = []);
    ensureSetIds(ex);
    const last = sets[sets.length - 1];
    const drop = Math.max(0, Math.round((last.weight * 0.75) / 2.5) * 2.5);
    const created = { id: makeSetId(), weight: drop, reps: last.reps, setType: 'drop' };
    sets.push(created);
    seedSetDraft(created);
    saveActiveWorkout(); haptic('medium');
    updateExerciseCardInDOM(exIdx, ex);
}

function confirmRemoveSet(exIdx, setId) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    const set = findSetById(ex, setId);
    if (!set) return;
    const num = ex.sets.indexOf(set) + 1;
    showConfirm('Удалить подход ' + num + '?', function (ok) { if (ok) removeSet(exIdx, setId); });
}

// Единственный путь удаления подхода: удаляем по стабильному id из state,
// затем пересобираем список. Последний подход тоже удаляется — список может
// стать пустым, «+ Подход» тогда добавляет первый подход с нулевым весом.
// Черновик удалённого подхода чистится ДО записи состояния в localStorage,
// иначе следующий рендер (в т.ч. после «+ Подход») восстановит значение.
function removeSet(exIdx, setId) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex || !Array.isArray(ex.sets)) return;
    const idx = ex.sets.findIndex(function (s) { return s.id === setId; });
    if (idx === -1) return; // уже удалён — повторный вызов безопасен
    try { commitVisibleSetInputs(exIdx); }
    catch (err) { console.error('commitVisibleSetInputs failed', err); }
    ex.sets.splice(idx, 1);
    if (typeof saveSetDraft === 'function') {
        saveSetDraft(setId, 'weight', '');
        saveSetDraft(setId, 'reps', '');
    }
    saveActiveWorkout(); haptic('light');
    updateExerciseCardInDOM(exIdx, ex);
}

function updateSet(exIdx, setId, field, value) { const set = findSetById(state.activeWorkout.exercises[exIdx], setId); if (!set) return; set[field] = value; saveActiveWorkout(); }
function startWorkout(programId) { const program = DataAPI.getProgramById(programId); if (!program || !(program.exercises || []).length) { showAlert('Нет упражнений'); return; } state.activeWorkout = { programId: program.id, programName: program.name, startTime: Date.now(), exercises: program.exercises.map(function (ex) { return { name: ex.name, muscleGroup: ex.muscleGroup, exerciseType: ex.exerciseType || 'weighted', supersetId: ex.supersetId || null, targetSets: ex.targetSets, targetReps: ex.targetReps, sets: [{ id: makeSetId(), weight: 0, reps: ex.targetReps || 10, setType: 'regular' }] }; }) }; saveActiveWorkout(); navigate('workout'); }
function startTimer() { stopWorkoutTimer(); const update = function () { if (!state.activeWorkout) return; const elapsed = Math.max(0, Date.now() - state.activeWorkout.startTime); const h = Math.floor(elapsed / 3600000), m = Math.floor((elapsed % 3600000) / 60000), s = Math.floor((elapsed % 60000) / 1000); const el = document.getElementById('workout-timer'); if (el) el.innerText = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }; update(); state.workoutTimer = setInterval(update, 1000); }
function stopWorkoutTimer() { if (state.workoutTimer) { clearInterval(state.workoutTimer); state.workoutTimer = null; } }
function clearWorkoutState() { stopWorkoutTimer(); state.activeWorkout = null; if (typeof clearAllSetDrafts === 'function') clearAllSetDrafts(); saveActiveWorkout(); clearMainButton(); }
