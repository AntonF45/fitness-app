/* features/workout/workout-context-menu.js — контекстные действия экрана тренировки.

   Архитектурное место: слой features/workout (view + controller одного блока).

   Поведение:
     • клик по кнопке «⋮» в углу карточки упражнения → «Добавить комментарий» / «Удалить упражнение»;
       (data-action="exercise-menu" → ui/event-delegation.js → openExerciseContextMenu;
        долгое нажатие на заголовок убрано — жест не срабатывал в Telegram WebView);
     • долгое нажатие на строку подхода              → «Добавить комментарий» / «Удалить подход»
       (data-longpress="context-set", распознавание жеста — ui/long-press.js);
     • оба удаления идут через подтверждение (showConfirm), случайное удаление исключено;
     • комментарий открывает модалку ощущений (set-note-modal.js) с фокусом на нужном подходе.

   Модуль не трогает localStorage напрямую (только saveActiveWorkout()) и не перерисовывает
   экран целиком — точечно через updateExerciseCardInDOM()/renderWorkout(). */
'use strict';

const CTX_MENU_ID = 'workout-context-menu';

// ---------- helpers ----------
function _ctxExercise(exIdx) {
    return state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
}

function formatSetSummary(set) {
    if (!set) return '';
    const w = Number(set.weight) || 0, r = Number(set.reps) || 0;
    const label = set.setType === 'drop' ? 'дроп-подход' : 'подход';
    return label + ' · ' + w + ' кг × ' + r;
}

// ---------- view: bottom-sheet меню ----------
function closeWorkoutContextMenu() { const m = document.getElementById(CTX_MENU_ID); if (m) m.remove(); }

function openWorkoutContextMenu(title, subtitle, items) {
    closeWorkoutContextMenu();
    const modal = document.createElement('div');
    modal.id = CTX_MENU_ID;
    modal.className = 'modal-backdrop';
    modal.innerHTML =
        '<div class="modal-sheet">' +
            '<div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-4"></div>' +
            '<h2 class="text-lg font-bold leading-snug break-words">' + escHtml(title) + '</h2>' +
            (subtitle ? '<p class="text-tgHint text-xs mt-1 mb-4">' + escHtml(subtitle) + '</p>' : '<div class="mb-3"></div>') +
            '<div class="space-y-3">' +
                items.map(function (it) {
                    return '<button data-action="' + it.action + '" data-payload="' + escAttr(it.payload) + '" class="btn ' + it.cls + '">' +
                        '<i class="fa-solid ' + it.icon + '"></i> ' + escHtml(it.label) + '</button>';
                }).join('') +
            '</div>' +
            '<button data-action="close-modal" data-modal="' + CTX_MENU_ID + '" class="btn btn-secondary mt-3">Отмена</button>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeWorkoutContextMenu(); });
    haptic('light');
}

// ---------- exercise: context-exercise ----------
function openExerciseContextMenu(exIdx) {
    const ex = _ctxExercise(exIdx);
    if (!ex) return;
    openWorkoutContextMenu(ex.name, (ex.sets || []).length + ' подх.', [
        { action: 'note-exercise', payload: String(exIdx), label: 'Добавить комментарий', icon: 'fa-comment-dots', cls: 'btn-primary' },
        { action: 'remove-workout-exercise', payload: String(exIdx), label: 'Удалить упражнение', icon: 'fa-trash-can', cls: 'btn-danger' }
    ]);
}

// ---------- set: context-set ----------
function openSetContextMenu(exIdx, setIdx) {
    const ex = _ctxExercise(exIdx);
    if (!ex || !ex.sets || !ex.sets[setIdx]) return;
    openWorkoutContextMenu(ex.name, formatSetSummary(ex.sets[setIdx]), [
        { action: 'note-exercise', payload: String(exIdx), label: 'Добавить комментарий', icon: 'fa-comment-dots', cls: 'btn-primary' },
        { action: 'remove-set', payload: exIdx + ':' + setIdx, label: 'Удалить подход', icon: 'fa-trash-can', cls: 'btn-danger' }
    ]);
}

// ---------- реестр жестов long-press (только подходы; меню упражнения — по клику «⋮») ----------
registerLongPressHandler('context-set', function (action, payload) {
    const p = String(payload).split(':');
    openSetContextMenu(parseInt(p[0], 10), parseInt(p[1], 10));
});
