/* features/workout/add-exercise-modal.js — модалка добавления нового упражнения в активную тренировку. */
'use strict';

function openAddWorkoutExerciseModal() {
    const existing = document.getElementById('add-exercise-modal'); if (existing) existing.remove();
    const modal = document.createElement('div'); modal.id = 'add-exercise-modal'; modal.className = 'modal-backdrop';
    const groups = getMuscleGroups();
    modal.innerHTML = '<div class="modal-sheet"><div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-5"></div><h2 class="text-xl font-bold mb-4">Новое упражнение</h2>' +
        '<div class="ac-wrapper mb-3"><input type="text" id="add-ex-group" placeholder="Группа мышц" data-scope="workout" data-exercise-index="0" class="muscle-input w-full p-3 text-sm font-medium" autocomplete="off"><div class="autocomplete-dropdown" id="ac-drop-muscle-workout-0" style="display:none"></div></div>' +
        '<div class="ac-wrapper mb-3"><input type="text" id="add-ex-name" placeholder="Название" data-scope="workout" data-exercise-index="0" class="exercise-name-input w-full p-3 text-sm font-medium" autocomplete="off"><div class="autocomplete-dropdown" id="ac-drop-workout-0" style="display:none"></div></div>' +
        '<label class="checkbox-label app-inset mb-3 p-3"><input type="checkbox" id="add-ex-bw"><span class="text-sm font-medium">Собственный вес</span></label>' +
        '<div class="flex gap-3 mb-4"><div class="flex-1"><label class="section-label">Подходы</label><input type="number" id="add-ex-sets" inputmode="numeric" value="3" class="w-full h-10 text-sm text-center font-semibold"></div><div class="flex-1"><label class="section-label">Повторения</label><input type="number" id="add-ex-reps" inputmode="numeric" value="10" class="w-full h-10 text-sm text-center font-semibold"></div></div>' +
        '<button data-action="add-workout-exercise-confirm" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Добавить</button>' +
        '<button data-action="close-modal" data-modal="add-exercise-modal" class="btn btn-secondary mt-3">Отмена</button></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
}
function confirmAddWorkoutExercise() {
    if (!state.activeWorkout) return;
    const nameEl = document.getElementById('add-ex-name');
    const name = ((nameEl && nameEl.value) || '').trim();
    if (!name) { showAlert('Введите название'); return; }
    const groupEl = document.getElementById('add-ex-group');
    const group = ((groupEl && groupEl.value) || '').trim();
    if (!group || getMuscleGroups().indexOf(group) === -1) { showAlert('Выберите группу мышц из списка'); return; }
    const bwEl = document.getElementById('add-ex-bw');
    const sets = Math.max(1, parseInt((document.getElementById('add-ex-sets') || {}).value, 10) || 3);
    const reps = Math.max(1, parseInt((document.getElementById('add-ex-reps') || {}).value, 10) || 10);
    state.activeWorkout.exercises.push({ name: name, muscleGroup: group, exerciseType: (bwEl && bwEl.checked) ? 'bodyweight' : 'weighted', supersetId: null, targetSets: sets, targetReps: reps, sets: [{ weight: 0, reps: reps, setType: 'regular' }] });
    saveActiveWorkout();
    const modal = document.getElementById('add-exercise-modal'); if (modal) modal.remove();
    haptic('success');
    renderWorkout();
}
