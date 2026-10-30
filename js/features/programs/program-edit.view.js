/* features/programs/program-edit.view.js — экран редактирования программы (форма).
   Только разметка; мутации состояния — в editor.controller.js. */
'use strict';

function renderProgramEdit() {
    const program = state.editingProgram || { name: '', exercises: [] };
    const exercises = program.exercises || [];
    const allSsIds = exercises.map(function (e) { return e.supersetId; });
    const activeSsId = state.supersetActiveId;

    let supersetBanner = '';
    if (activeSsId) {
        const style = getSupersetStyle(activeSsId, allSsIds);
        const groupExs = exercises.filter(function (e) { return e.supersetId === activeSsId; });
        const num = getSupersetNumber(activeSsId, exercises);
        let listHTML = groupExs.map(function (e, i) {
            return '<div class="flex items-start gap-1.5 py-0.5"><span class="font-mono text-[10px] shrink-0 mt-0.5" style="color: ' + style.text + '">' + (i + 1) + '.</span><span class="text-xs font-semibold leading-snug break-words">' + escHtml(e.name || 'Без названия') + '</span></div>';
        }).join('');
        if (groupExs.length < 2) listHTML += '<div class="text-[10px] opacity-80 mt-1">Нажмите <i class="fa-solid fa-link"></i> у второго упражнения, чтобы завершить</div>';
        supersetBanner =
            '<div class="sticky top-2 z-30 mb-3 px-3 py-2.5 rounded-xl shadow-xl card-enter" style="background: linear-gradient(90deg, ' + style.badgeBg + ', ' + style.bg + '), var(--tg-theme-bg-color, #1c1c1e); border: 1.5px solid ' + style.border + '; border-left-width: 5px;">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="min-w-0 flex-1">' +
                        '<div class="text-[10px] font-bold uppercase tracking-wide mb-1" style="color: ' + style.text + '"><i class="fa-solid fa-bolt mr-1"></i>Суперсет №' + num + '</div>' +
                        '<div class="space-y-0.5">' + listHTML + '</div>' +
                    '</div>' +
                    '<button onclick="finishSupersetCreation()" class="btn btn-sm btn-auto" style="background: ' + style.border + '; color: #ffffff;">Готово ✓</button>' +
                '</div>' +
            '</div>';
    }

    let exercisesHTML = exercises.map(function (exercise, index) {
        const isIn = activeSsId && exercise.supersetId === activeSsId;
        const isBw = exercise.exerciseType === 'bodyweight';
        const style = getSupersetStyle(exercise.supersetId, allSsIds);
        let btnStyle = '', btnClass = 'btn-icon', btnTitle = 'Объединить в суперсет';
        if (activeSsId) { if (isIn) { btnStyle = 'background: ' + style.border + '; color: #ffffff;'; btnTitle = 'В активном суперсете'; } else { btnStyle = 'border: 2px dashed ' + style.border + '; color: ' + style.text + ';'; btnClass = 'btn-icon animate-pulse'; btnTitle = 'Добавить в суперсет'; } }
        else if (exercise.supersetId) { btnStyle = 'background: ' + style.badgeBg + '; color: ' + style.text + '; border: 1px solid ' + style.border + ';'; }
        return '<div class="app-card mb-3 card-enter" style="animation-delay: ' + (index * 0.05) + 's; ' + (exercise.supersetId ? style.styleAttr : '') + '">' +
            '<div class="flex justify-between items-center mb-3"><span class="section-label" style="margin:0">Упражнение ' + (index + 1) + '</span><div class="flex gap-1"><button data-action="toggle-superset" data-payload="' + index + '" title="' + escAttr(btnTitle) + '" class="' + btnClass + '" style="' + btnStyle + '"><i class="fa-solid fa-link"></i></button><button data-action="remove-exercise" data-payload="' + index + '" class="btn-icon danger" aria-label="Удалить упражнение"><i class="fa-solid fa-times"></i></button></div></div>' +
            '<div class="ac-wrapper mb-3"><input type="text" placeholder="Группа мышц" value="' + escAttr(exercise.muscleGroup || '') + '" data-scope="editor" data-exercise-index="' + index + '" data-field="muscleGroup" class="muscle-input w-full p-3 text-sm font-medium" autocomplete="off"><div class="autocomplete-dropdown" id="ac-drop-muscle-editor-' + index + '" style="display:none"></div></div>' +
            '<div class="ac-wrapper mb-3"><input type="text" placeholder="Название" value="' + escAttr(exercise.name) + '" data-scope="editor" data-exercise-index="' + index + '" data-field="name" class="exercise-input exercise-name-input w-full p-3 text-sm font-medium" autocomplete="off"><div class="autocomplete-dropdown" id="ac-drop-editor-' + index + '" style="display:none"></div></div>' +
            '<label class="checkbox-label app-inset mb-3 p-3"><input type="checkbox" ' + (isBw ? 'checked' : '') + ' data-exercise-index="' + index + '" data-field="exerciseType" class="exercise-checkbox"><span class="text-sm font-medium">Собственный вес</span></label>' +
            '<div class="flex gap-3"><div class="flex-1"><label class="section-label">Подходы</label><div class="flex items-center gap-1"><button data-action="adjust-param" data-payload="' + index + ':targetSets:-1" class="step-btn lg">−</button><input type="number" id="sets-' + index + '" inputmode="numeric" value="' + (exercise.targetSets ?? 3) + '" data-exercise-index="' + index + '" data-field="targetSets" class="exercise-input w-full h-10 text-sm text-center font-semibold"><button data-action="adjust-param" data-payload="' + index + ':targetSets:1" class="step-btn lg">+</button></div></div><div class="flex-1"><label class="section-label">Повторения</label><div class="flex items-center gap-1"><button data-action="adjust-param" data-payload="' + index + ':targetReps:-1" class="step-btn lg">−</button><input type="number" id="reps-' + index + '" inputmode="numeric" value="' + (exercise.targetReps ?? 10) + '" data-exercise-index="' + index + '" data-field="targetReps" class="exercise-input w-full h-10 text-sm text-center font-semibold"><button data-action="adjust-param" data-payload="' + index + ':targetReps:1" class="step-btn lg">+</button></div></div></div>' +
            '</div>';
    }).join('');

    document.getElementById('app-content').innerHTML =
        '<input type="text" id="prog-name" placeholder="Название программы" value="' + escAttr(program.name) + '" class="w-full p-4 rounded-2xl mb-3 text-lg font-semibold card-enter">' +
        '<button data-action="open-mg-modal" class="btn btn-secondary mb-3"><i class="fa-solid fa-pen-to-square"></i> Управление группами мышц</button>' +
        supersetBanner +
        '<div id="exercises-list">' + exercisesHTML + '</div>' +
        '<button data-action="add-exercise" class="btn btn-dashed mt-2"><i class="fa-solid fa-plus"></i> Добавить упражнение</button>' +
        '<div style="height: 110px"></div>' +
        '<div class="sticky-bottom-action"><button data-action="save-program" class="btn btn-primary"><i class="fa-solid fa-check"></i> Сохранить</button></div>';
    clearMainButton();
}
