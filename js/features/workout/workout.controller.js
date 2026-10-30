/* features/workout/workout.controller.js — экран активной тренировки: подходы, дроп-сеты,
   таймер, старт/завершение сессии. */
'use strict';

// Строка подхода — единый блок без границы, с заливкой в цвет карточки упражнения:
// порядковый номер, группы кнопок − / + и поля ввода (вес, повторения).
// Единицы («кг», «повт») стоят в той же строке сразу после кнопки «+» (см. .set-field в css).
// Удаление подхода — свайпом влево по строке (жест как в Telegram: открытие → схлопывание),
// долгим нажатием доступно меню (комментарий / удалить с подтверждением).
function generateSetHTML(exIdx, setIdx, set, exType) {
    const isDrop = set.setType === 'drop';
    const bw = exType === 'bodyweight';
    // Заметка-комментарий теперь одна на упражнение (ex.note) — под списком подходов, не у каждой строки.
    return '<li id="set-row-' + exIdx + '-' + setIdx + '" class="set-line card-enter' + (isDrop ? ' set-drop' : '') + '" data-swipe-left="delete-set" data-payload="' + exIdx + ':' + setIdx + '" data-longpress="context-set">' +
        '<div class="set-swipe-bg"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>' +
        '<div class="set-line-inner">' +
        '<div class="set-line-main">' +
            '<span class="set-num">' + (setIdx + 1) + '</span>' +
            (isDrop ? '<i class="fa-solid fa-fire set-num-drop" title="Дроп-подход"></i>' : '') +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:-2.5" class="step-btn" aria-label="Меньше вес">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-weight" inputmode="decimal" value="' + set.weight + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="weight" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="' + (bw ? 'Доп. вес, кг' : 'Вес, кг') + '">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':weight:2.5" class="step-btn" aria-label="Больше вес">+</button>' +
                '<span class="unit-hint shrink-0">кг</span>' +
            '</div>' +
            '<div class="set-field">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:-1" class="step-btn" aria-label="Меньше повторов">−</button>' +
                '<input type="number" id="set-' + exIdx + '-' + setIdx + '-reps" inputmode="numeric" value="' + set.reps + '" data-exercise="' + exIdx + '" data-set="' + setIdx + '" data-field="reps" class="set-input input-bare h-9 text-center text-base font-semibold min-w-0" aria-label="Повторения">' +
                '<button data-action="adjust-set" data-payload="' + exIdx + ':' + setIdx + ':reps:1" class="step-btn" aria-label="Больше повторов">+</button>' +
                '<span class="unit-hint shrink-0">повт</span>' +
            '</div>' +
        '</div>' +
        '</div>' +
    '</li>';
}
function generateExerciseCardHTML(exIdx, ex) {
    const sets = ex.sets || [];
    const completed = sets.filter(function (s) { return s.weight > 0 && s.reps > 0; }).length;
    const target = ex.targetSets ?? 3;
    const isComplete = completed >= target;   // «✓ Готово» — только по числу заполненных подходов
    const hasNotes = !!(ex.note && String(ex.note).trim());
    // Заголовок: название — зона долгого нажатия (контекстное меню: удалить / комментарий).
    // Кнопка «крестик» убрана, удаление упражнения — только через контекст с подтверждением.
    // Отдельная кнопка «Ощущения» убрана: комментарий добавляется тем же долгим нажатием,
    // наличие заметки показывается иконкой в заголовке и блоком под списком подходов.
    // Меню упражнения открывается обычной кнопкой «⋮» (data-action="exercise-menu") —
    // надёжный клик вместо долгого нажатия, которое не срабатывало в Telegram WebView.
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
// Инкрементальное обновление списка подходов карточки БЕЗ замены узлов целиком.
// Ключевой момент для свайп-удаления: sync НЕ удаляет строку, анимация схлопывания
// которой ещё не завершена (свойство swipeAnimating выставляет ui/swipe-delete.js).
// Такие «замороженные» строки также не участвуют в перенумерации — индексы
// оставшихся строк приводятся в соответствие с данными только после финализации.
// Функция идемпотентна: повторный вызов ничего лишнего не меняет.
function syncSetsListInPlace(exIdx, ex) {
    const list = document.getElementById('sets-container-' + exIdx);
    if (!list) return false;

    // 1) Удаляем из DOM строки, помеченные свайпом как «удаляемые» (и любые строки,
    //    чей setIdx больше числа подходов в данных — на случай рассинхронизации).
    //    Строки с незавершённой анимацией (swipeAnimating) не трогаем вовсе.
    const nSets = ex.sets.length;
    let cur = list.firstElementChild;
    while (cur) {
        const next = cur.nextElementSibling;
        if (cur.swipeAnimating) { cur = next; continue; }
        const p = String(cur.dataset.payload || '').split(':');
        const sIdx = parseInt(p[1], 10);
        if (cur.dataset.swipeRemoving === '1' || (!isNaN(sIdx) && sIdx >= nSets)) {
            cur.remove();
        }
        cur = next;
    }

    // 2) Синхронизируем оставшиеся видимые строки с данными по позиции.
    //    Позиция считается среди строк без «заморозки», чтобы не переписывать
    //    payload/разметку схлопываемой строки в разгар анимации.
    const visible = [];
    cur = list.firstElementChild;
    while (cur) {
        if (!cur.swipeAnimating && cur.dataset.swipeRemoving !== '1') visible.push(cur);
        cur = cur.nextElementSibling;
    }
    for (let i = 0; i < nSets; i++) {
        let li = visible[i];
        if (!li) {                                   // не хватает — добавляем новую строку
            const tmp = document.createElement('ol');
            tmp.innerHTML = generateSetHTML(exIdx, i, ex.sets[i], ex.exerciseType);
            list.appendChild(tmp.firstElementChild);
            li = list.lastElementChild;
            visible[i] = li;
        } else {                                     // обновляем содержимое существующей
            const srcTmp = document.createElement('ol');
            srcTmp.innerHTML = generateSetHTML(exIdx, i, ex.sets[i], ex.exerciseType);
            const src = srcTmp.firstElementChild;
            li.id = src.id;
            li.className = src.className;            // card-enter/set-drop и т.п.
            li.dataset.payload = src.dataset.payload;
            const inner = li.querySelector('.set-line-inner');
            const srcInner = src.querySelector('.set-line-inner');
            if (inner && srcInner) inner.innerHTML = srcInner.innerHTML;
        }
    }
    // 3) Лишние видимые строки (если данных стало меньше без пометки свайпом).
    for (let i = visible.length - 1; i >= nSets; i--) {
        if (visible[i].parentNode === list) list.removeChild(visible[i]);
    }
    return true;
}

function updateExerciseCardInDOM(exIdx, ex) {
    const card = document.getElementById('exercise-card-' + exIdx);
    if (!card) { renderWorkout(); return; }   // карточки нет в DOM — перерисовываем экран

    // Инкрементальная синхронизация (или no-op во время свайп-анимации).
    if (syncSetsListInPlace(exIdx, ex)) {
        updateExerciseBadge(exIdx);
        return;
    }
    card.outerHTML = generateExerciseCardHTML(exIdx, ex);
}
function updateExerciseBadge(exIdx) { const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null; if (!ex) return; const completed = ex.sets.filter(function (s) { return s.weight > 0 && s.reps > 0; }).length; const target = ex.targetSets ?? 3; const badge = document.getElementById('badge-' + exIdx); if (badge) { badge.className = 'text-xs font-medium px-2 py-1 rounded-md shrink-0 ' + (completed >= target ? 'bg-green-500/20 text-green-500' : 'app-inset text-tgHint'); badge.innerText = completed >= target ? '✓ Готово' : completed + '/' + target; } }
function removeWorkoutExercise(exIdx) { closeWorkoutContextMenu(); showConfirm('Удалить это упражнение из тренировки?', function (ok) { if (ok) { state.activeWorkout.exercises.splice(exIdx, 1); saveActiveWorkout(); haptic('light'); renderWorkout(); } }); }
// Перед добавлением подхода убеждаемся, что последний заполнен; подсказываем про комментарий.
function tryAddSet(exIdx) {
    const sets = state.activeWorkout.exercises[exIdx].sets || [];
    if (sets.length > 0) {
        const last = sets[sets.length - 1];
        if (!last.weight || Number(last.weight) <= 0 || !last.reps || Number(last.reps) <= 0) {
            showAlert('Заполните предыдущий подход');
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
    // Принудальная привязка свайп-зон к freshly-отрисованным строкам — не полагаемся
    // только на MutationObserver (см. ui/swipe-delete.js).
    if (typeof window.bindSwipeZones === 'function') window.bindSwipeZones();
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
// Удаление подхода. Данные (state + localStorage) меняются сразу; DOM-строку
// убирает свайп-модуль после анимации схлопывания — syncSetsListInPlace трогает
// только строки без флага swipeAnimating, поэтому «возврат» подхода невозможен.
function removeSet(exIdx, setIdx) {
    const sets = state.activeWorkout.exercises[exIdx].sets;
    if (sets.length <= 1) sets[0] = { weight: 0, reps: 10, setType: 'regular' };
    else sets.splice(setIdx, 1);
    saveActiveWorkout();
    haptic('light');
    updateExerciseCardInDOM(exIdx, state.activeWorkout.exercises[exIdx]);
}
// Свайп влево по строке подхода — удаление сразу, как в Telegram (жест сам по себе
// осознанный): ui/swipe-delete.js показывает красную зону, долёт строки и схлопывание,
// и только затем вызывает этот обработчик — данные меняются и карточка перерисовывается.
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
function clearWorkoutState() { stopWorkoutTimer(); state.activeWorkout = null; saveActiveWorkout(); clearMainButton(); }
