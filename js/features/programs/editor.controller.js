/* features/programs/editor.controller.js — бизнес-логика редактора программы:
   изменение полей, суперсеты, валидация и сохранение. */
'use strict';

function updateProgramName(value) { if (!state.editingProgram) state.editingProgram = { name: '', exercises: [] }; state.editingProgram.name = value; }
function adjustProgramParam(index, field, delta) { const ex = state.editingProgram.exercises[index]; if (!ex) return; ex[field] = Math.max(1, (ex[field] ?? (field === 'targetSets' ? 3 : 10)) + delta); haptic('light'); const input = document.getElementById((field === 'targetSets' ? 'sets' : 'reps') + '-' + index); if (input) input.value = ex[field]; }
function addExercise() { if (!state.editingProgram) state.editingProgram = { name: '', exercises: [] }; if (!state.editingProgram.exercises) state.editingProgram.exercises = []; state.editingProgram.exercises.push({ id: createId(), name: '', muscleGroup: '', exerciseType: 'weighted', supersetId: null, targetSets: 3, targetReps: 10 }); renderProgramEdit(); }
function removeExercise(index) {
    const exercises = (state.editingProgram && state.editingProgram.exercises) || [];
    const removed = exercises[index];
    if (!removed) return;
    const ssId = removed.supersetId;
    exercises.splice(index, 1);
    if (ssId) {
        if (countSupersetMembers(exercises, ssId) < 2) {
            dissolveSuperset(exercises, ssId);
            if (state.supersetActiveId === ssId) state.supersetActiveId = null;
        }
    }
    renderProgramEdit();
}
function updateExercise(index, field, value) { if (!state.editingProgram) state.editingProgram = { name: '', exercises: [] }; if (!state.editingProgram.exercises[index]) return; state.editingProgram.exercises[index][field] = value; }
function toggleSupersetClick(index) {
    const exercises = (state.editingProgram && state.editingProgram.exercises) || [];
    const current = exercises[index];
    if (!current) return;
    if (!state.supersetActiveId) {
        if (!current.supersetId) { current.supersetId = createId(); state.supersetActiveId = current.supersetId; haptic('medium'); }
        else { state.supersetActiveId = current.supersetId; haptic('light'); }
        renderProgramEdit();
        return;
    }
    const activeId = state.supersetActiveId;
    if (current.supersetId === activeId) {
        current.supersetId = null;
        if (countSupersetMembers(exercises, activeId) < 2) { dissolveSuperset(exercises, activeId); state.supersetActiveId = null; }
        haptic('light');
        renderProgramEdit();
        return;
    }
    if (!current.supersetId) { current.supersetId = activeId; haptic('success'); renderProgramEdit(); return; }
    const otherId = current.supersetId;
    const otherNum = getSupersetNumber(otherId, exercises);
    const activeNum = getSupersetNumber(activeId, exercises);
    showConfirm(
        'Это упражнение уже в суперсете №' + otherNum + '. Перенести его в суперсет №' + activeNum + '?' +
        (countSupersetMembers(exercises, otherId) <= 2 ? ' Суперсет №' + otherNum + ' будет расформирован.' : ''),
        function (ok) {
            if (!ok) { haptic('light'); return; }
            current.supersetId = activeId;
            if (countSupersetMembers(exercises, otherId) < 2) dissolveSuperset(exercises, otherId);
            haptic('success');
            renderProgramEdit();
        }
    );
}
function finishSupersetCreation() {
    if (!state.supersetActiveId) return;
    const exercises = (state.editingProgram && state.editingProgram.exercises) || [];
    const remained = countSupersetMembers(exercises, state.supersetActiveId);
    state.supersetActiveId = null;
    if (remained < 2) { normalizeSupersets(exercises); showAlert('Суперсет не сохранён: нужно минимум 2 упражнения'); haptic('warning'); }
    else { haptic('success'); }
    renderProgramEdit();
}
function saveProgram() {
    const name = ((document.getElementById('prog-name') || {}).value || '').trim();
    if (!name) { showAlert('Введите название'); return; }
    if (!state.editingProgram || (state.editingProgram.exercises || []).length === 0) { showAlert('Добавьте упражнение'); return; }
    const groups = getMuscleGroups();
    for (let i = 0; i < state.editingProgram.exercises.length; i++) {
        const ex = state.editingProgram.exercises[i];
        if (!(ex.name || '').trim()) { showAlert('Заполните названия'); return; }
        if (!ex.muscleGroup || groups.indexOf(ex.muscleGroup) === -1) { showAlert('Выберите группу мышц из списка для «' + (ex.name || 'упражнения ' + (i + 1)) + '»'); return; }
    }
    normalizeSupersets(state.editingProgram.exercises);
    state.supersetActiveId = null;
    state.editingProgram.name = name;
    const programs = DataAPI.getPrograms();
    const idx = programs.findIndex(function (p) { return p.id === state.editingProgram.id; });
    if (idx > -1) programs[idx] = state.editingProgram;
    else { state.editingProgram.id = createId(); programs.push(state.editingProgram); }
    DataAPI.savePrograms(programs);
    haptic('success');
    state.editingProgram = null;
    openProgramsScreen();
}
function deleteProgram(id) { showConfirm('Удалить программу?', function (ok) { if (ok) { DataAPI.savePrograms(DataAPI.getPrograms().filter(function (p) { return p.id !== id; })); renderPrograms(); } }); }
