/* features/workout/workout-exit-modal.js — модалка выхода из тренировки:
   сохранить в историю / не сохранять / отмена. */
'use strict';

let workoutDialogOpen = false;
function promptWorkoutExit() {
    if (workoutDialogOpen) return;
    workoutDialogOpen = true; clearMainButton();
    const existing = document.getElementById('workout-exit-modal'); if (existing) existing.remove();
    const modal = document.createElement('div'); modal.id = 'workout-exit-modal'; modal.className = 'modal-backdrop';
    modal.innerHTML = '<div class="modal-sheet"><div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-5"></div><h2 class="text-xl font-bold text-center mb-2">Завершить тренировку?</h2><p class="text-tgHint text-sm text-center mb-5">Что сделать с текущей тренировкой?</p><div class="space-y-3"><button data-action="workout-save" class="btn btn-primary"><i class="fa-solid fa-check mr-2"></i> Завершить и сохранить</button><button data-action="workout-discard" class="btn btn-danger"><i class="fa-solid fa-trash mr-2"></i> Не сохранять</button><button data-action="workout-cancel" class="btn btn-secondary">Отмена</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) { workoutDialogOpen = false; modal.remove(); } });
}
function closeWorkoutModal() { const m = document.getElementById('workout-exit-modal'); if (m) m.remove(); workoutDialogOpen = false; }
function saveWorkoutAndOpenPrograms() { try { const w = state.activeWorkout; if (w) { const hist = DataAPI.getHistory(); hist.push({ id: createId(), date: new Date(w.startTime).toISOString(), duration: Math.max(0, Math.round((Date.now() - w.startTime) / 1000)), programName: w.programName, exercises: w.exercises.map(function (ex) { return { name: ex.name, muscleGroup: ex.muscleGroup || '', exerciseType: ex.exerciseType || 'weighted', supersetId: ex.supersetId || null, targetSets: ex.targetSets ?? 3, targetReps: ex.targetReps ?? 10, sets: (ex.sets || []).map(function (s) { var o = { weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, setType: s.setType || 'regular' }; return o; }), note: ex.note ? String(ex.note).slice(0, 300) : undefined }; }) }); DataAPI.saveHistory(hist); } clearWorkoutState(); haptic('success'); } catch (e) { console.error(e); clearWorkoutState(); } openProgramsScreen(); }
function discardWorkoutAndOpenPrograms() { clearWorkoutState(); haptic('light'); openProgramsScreen(); }
