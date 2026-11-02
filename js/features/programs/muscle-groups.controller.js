/* features/programs/muscle-groups.controller.js — модалка управления группами мышц:
   добавление/переименование/удаление + каскадное переименование в программах и истории. */
'use strict';

let mgEditState = null;
function openMuscleGroupsModal() {
    mgEditState = null;
    const existing = document.getElementById('mg-modal'); if (existing) existing.remove();
    const modal = document.createElement('div'); modal.id = 'mg-modal'; modal.className = 'modal-backdrop';
    modal.innerHTML = '<div class="modal-sheet"><div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-5"></div><h2 class="text-xl font-bold mb-4">Группы мышц</h2><div id="mg-list"></div><div class="flex gap-2 mt-4"><input id="mg-new-input" type="text" placeholder="Новая группа" class="flex-1 p-3 text-sm"><button data-action="mg-add" class="btn btn-primary btn-sm btn-auto"><i class="fa-solid fa-plus"></i></button></div><button data-action="close-modal" data-modal="mg-modal" class="btn btn-secondary mt-4">Закрыть</button></div>';
    document.body.appendChild(modal);
    renderMgList();
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
}
function renderMgList() {
    const list = document.getElementById('mg-list'); if (!list) return;
    const groups = getMuscleGroups();
    list.innerHTML = groups.map(function (g) {
        if (mgEditState === g) {
            return '<div class="flex gap-2 mb-2"><input id="mg-edit-input" type="text" value="' + escAttr(g) + '" class="flex-1 p-3 text-sm"><button data-action="mg-edit-save" data-payload="' + escAttr(g) + '" class="btn-icon primary" aria-label="Сохранить"><i class="fa-solid fa-check"></i></button><button data-action="mg-edit-cancel" class="btn-icon" aria-label="Отмена"><i class="fa-solid fa-times"></i></button></div>';
        }
        return '<div class="flex items-center gap-2 mb-2 app-inset px-3 py-2"><div class="flex-1 text-sm font-medium break-words">' + escHtml(g) + '</div><button data-action="mg-edit-start" data-payload="' + escAttr(g) + '" class="btn-icon" aria-label="Переименовать"><i class="fa-solid fa-pen text-sm"></i></button><button data-action="mg-delete" data-payload="' + escAttr(g) + '" class="btn-icon danger" aria-label="Удалить"><i class="fa-solid fa-trash text-sm"></i></button></div>';
    }).join('') || '<div class="text-tgHint text-sm text-center py-2">Нет групп</div>';
}
function renameMuscleGroupEverywhere(oldName, newName) {
    const programs = DataAPI.getPrograms();
    programs.forEach(function (p) { (p.exercises || []).forEach(function (ex) { if (ex.muscleGroup === oldName) ex.muscleGroup = newName; }); });
    DataAPI.savePrograms(programs);
    const history = DataAPI.getHistory();
    history.forEach(function (e) { (e.exercises || []).forEach(function (ex) { if (ex.muscleGroup === oldName) ex.muscleGroup = newName; }); });
    DataAPI.saveHistory(history);
    if (state.selectedMuscleGroup === oldName) state.selectedMuscleGroup = newName;
    if (state.editingProgram) (state.editingProgram.exercises || []).forEach(function (ex) { if (ex.muscleGroup === oldName) ex.muscleGroup = newName; });
}
function mgAdd() {
    const input = document.getElementById('mg-new-input'); if (!input) return;
    const name = (input.value || '').trim();
    if (!name) { showAlert('Введите название'); return; }
    const groups = getMuscleGroups();
    if (groups.some(function (g) { return g.toLowerCase() === name.toLowerCase(); })) { showAlert('Такая группа уже есть'); return; }
    groups.push(name); saveMuscleGroups(groups); input.value = ''; haptic('success'); renderMgList();
}
function mgEditSave(oldName) {
    const input = document.getElementById('mg-edit-input'); if (!input) return;
    const newName = (input.value || '').trim();
    if (!newName) { showAlert('Введите название'); return; }
    if (newName === oldName) { mgEditState = null; renderMgList(); return; }
    const groups = getMuscleGroups();
    if (groups.some(function (g) { return g.toLowerCase() === newName.toLowerCase() && g !== oldName; })) { showAlert('Такая группа уже есть'); return; }
    groups[groups.indexOf(oldName)] = newName; saveMuscleGroups(groups);
    renameMuscleGroupEverywhere(oldName, newName);
    mgEditState = null; haptic('success'); renderMgList();
}
function mgDelete(name) {
    const inUse = DataAPI.getPrograms().some(function (p) { return (p.exercises || []).some(function (ex) { return ex.muscleGroup === name; }); }) ||
                  DataAPI.getHistory().some(function (e) { return (e.exercises || []).some(function (ex) { return ex.muscleGroup === name; }); });
    if (inUse) { showAlert('Группа используется упражнениями. Сначала перенесите их в другую группу.'); return; }
    showConfirm('Удалить группу «' + name + '»?', function (ok) {
        if (!ok) return;
        const groups = getMuscleGroups().filter(function (g) { return g !== name; });
        saveMuscleGroups(groups);
        if (state.selectedMuscleGroup === name) state.selectedMuscleGroup = groups[0] || 'Другое';
        haptic('light'); renderMgList();
    });
}
