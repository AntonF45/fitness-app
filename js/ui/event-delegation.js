/* ui/event-delegation.js — единая точка входа пользовательских событий.
   Все клики идут через data-action → диспетчер; инпуты/чейнджи — через маппинг классов.
   Добавляя новый экран, регистрируйте действие здесь, а не навешивайте onclick в HTML. */
'use strict';

// === click ===
document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action]');
    if (!event.target.closest('.ac-wrapper')) hideAllAutocomplete();
    // Клик вне контекстного меню закрывает его.
    if (typeof closeWorkoutContextMenu === 'function' && !event.target.closest('#workout-context-menu')) closeWorkoutContextMenu();
    if (!target) return;
    const action = target.dataset.action;
    const payload = target.dataset.payload;
    try {
        switch (action) {
            case 'switch-tab': switchTab(payload); break;
            case 'select-muscle-group': selectMuscleGroup(payload); break;
            case 'select-exercise': selectExercise(payload); break;
            case 'select-month': selectMonthFilter(payload); break;
            case 'select-period': selectPeriod(payload); break;
            case 'select-metric': selectExerciseMetric(payload); break;
            case 'toggle-filter': toggleFilterPanel(); break;
            case 'edit-program': navigate('program_edit', { programId: payload }); break;
            case 'delete-program': deleteProgram(payload); break;
            case 'start-workout': startWorkout(payload); break;
            case 'create-program': navigate('program_edit', { programId: null }); break;
            case 'add-exercise': addExercise(); break;
            case 'remove-exercise': removeExercise(parseInt(payload, 10)); break;
            case 'toggle-superset': toggleSupersetClick(parseInt(payload, 10)); break;
            case 'save-program': saveProgram(); break;
            case 'adjust-param': { const p = payload.split(':'); adjustProgramParam(parseInt(p[0], 10), p[1], parseInt(p[2], 10)); break; }
            case 'add-set': tryAddSet(parseInt(payload, 10)); break;
            case 'add-drop-set': tryAddDropSet(parseInt(payload, 10)); break;
            case 'remove-set': { const p = payload.split(':'); confirmRemoveSet(parseInt(p[0], 10), parseInt(p[1], 10)); break; }
            // ── контекстные действия ──
            case 'exercise-menu': openExerciseContextMenu(parseInt(payload, 10)); break;
            case 'note-exercise': openSetNoteModal(parseInt(payload, 10)); break;
            case 'adjust-set': { const p = payload.split(':'); adjustSet(parseInt(p[0], 10), parseInt(p[1], 10), p[2], parseFloat(p[3])); break; }
            case 'remove-workout-exercise': removeWorkoutExercise(parseInt(payload, 10)); break;
            case 'note-save': saveSetNotes(parseInt(payload, 10)); break;
            case 'note-skip': skipSetNotes(parseInt(payload, 10)); break;
            case 'finish-workout': promptWorkoutExit(); break;
            case 'workout-save': closeWorkoutModal(); saveWorkoutAndOpenPrograms(); break;
            case 'workout-discard': closeWorkoutModal(); discardWorkoutAndOpenPrograms(); break;
            case 'workout-cancel': closeWorkoutModal(); haptic('light'); break;
            case 'open-data-menu': openDataMenuModal(); break;
            case 'export-data': { const m = document.getElementById('data-menu-modal'); if (m) m.remove(); exportData(); break; }
            case 'import-data': { const m = document.getElementById('data-menu-modal'); if (m) m.remove(); triggerImportFile(); break; }
            case 'reset-data': { const m = document.getElementById('data-menu-modal'); if (m) m.remove(); resetAllData(); break; }
            case 'close-modal': { const m = document.getElementById(target.dataset.modal); if (m) m.remove(); break; }
            case 'history-detail': navigate('history_detail', { entryId: payload }); break;
            case 'open-mg-modal': openMuscleGroupsModal(); break;
            case 'mg-add': mgAdd(); break;
            case 'mg-edit-start': mgEditState = payload; renderMgList(); break;
            case 'mg-edit-save': mgEditSave(payload); break;
            case 'mg-edit-cancel': mgEditState = null; renderMgList(); break;
            case 'mg-delete': mgDelete(payload); break;
            case 'ac-pick': pickAutocomplete(target); break;
            case 'ac-muscle-pick': pickMuscleAutocomplete(target); break;
            case 'add-workout-exercise': openAddWorkoutExerciseModal(); break;
            case 'add-workout-exercise-confirm': confirmAddWorkoutExercise(); break;
        }
    } catch (err) { console.error('Delegated action error:', action, payload, err); }
});

// === ДЕЛЕГИРОВАНИЕ ВВОДА (input) ===
document.addEventListener('input', function (e) {
    try {
        const t = e.target;
        if (t.id === 'prog-name') { updateProgramName(t.value); return; }
        if (t.classList.contains('muscle-input')) {
            if ((t.dataset.scope || 'editor') === 'editor') updateExercise(parseInt(t.dataset.exerciseIndex, 10), 'muscleGroup', t.value);
            updateMuscleAutocomplete(t);
            return;
        }
        if (t.classList.contains('exercise-name-input')) {
            if ((t.dataset.scope || 'editor') === 'editor') updateExercise(parseInt(t.dataset.exerciseIndex, 10), 'name', t.value);
            updateAutocomplete(t);
            return;
        }
        if (t.classList.contains('exercise-input')) updateExercise(parseInt(t.dataset.exerciseIndex, 10), t.dataset.field, t.value);
        if (t.classList.contains('set-input')) {
            const exIdx = parseInt(t.dataset.exercise, 10), setIdx = parseInt(t.dataset.set, 10);
            saveSetDraft(exIdx, setIdx, t.dataset.field, t.value);
            updateExerciseBadge(exIdx);
        }
    } catch (err) {
        console.error('Input handler error:', err);
    }
});

// === focusin ===
document.addEventListener('focusin', function (e) {
    try {
        const t = e.target;
        if (t.classList.contains('muscle-input')) { updateMuscleAutocomplete(t); return; }
        if (t.classList.contains('exercise-name-input')) { updateAutocomplete(t); return; }
    } catch (err) {
        console.error('Focusin handler error:', err);
    }
});

// === change ===
document.addEventListener('change', function (e) {
    try {
        const t = e.target;
        if (t.classList.contains('exercise-select')) { updateExercise(parseInt(t.dataset.exerciseIndex, 10), t.dataset.field, t.value); return; }
        if (t.classList.contains('exercise-checkbox')) { updateExercise(parseInt(t.dataset.exerciseIndex, 10), t.dataset.field, t.checked ? 'bodyweight' : 'weighted'); return; }
        if (t.classList.contains('set-input')) {
            const exIdx = parseInt(t.dataset.exercise, 10), setIdx = parseInt(t.dataset.set, 10), field = t.dataset.field;
            const value = field === 'weight' ? parseWeight(t.value) : parseReps(t.value);
            const set = state.activeWorkout && state.activeWorkout.exercises && state.activeWorkout.exercises[exIdx] ? state.activeWorkout.exercises[exIdx].sets[setIdx] : null;
            if (value === null) { showAlert('Недопустимое значение'); if (set) { t.value = set[field]; saveSetDraft(exIdx, setIdx, field, String(set[field])); } return; }
            if (set) { updateSet(exIdx, setIdx, field, value); saveSetDraft(exIdx, setIdx, field, String(value)); updateExerciseBadge(exIdx); }
        }
    } catch (err) {
        console.error('Change handler error:', err);
    }
});
