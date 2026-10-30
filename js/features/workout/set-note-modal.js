/* features/workout/set-note-modal.js — всплывающее окно «ощущения» после завершения упражнения.

   Архитектурное место: слой features/workout (view + controller одного фичевого блока).
   - НЕ работает с localStorage напрямую: заметка живёт в state.activeWorkout и сохраняется
     через saveActiveWorkout(); при завершении тренировки её забирает workout-exit-modal.js
     и кладёт в ex.note записи истории (DataAPI.saveHistory);
   - НЕ навешивает onclick сам: все клики идут через data-action → ui/event-delegation.js;
   - НЕ перерисовывает экран целиком: только свою карточку через updateExerciseCardInDOM().

   Модель данных (поле опционально — старые черновики/записи без note работают как раньше):
     activeWorkout.exercises[i].note        : string  — общий комментарий к упражнению
     activeWorkout.exercises[i].completed   : boolean — «ощущения внесены» (бейдж ✓ Готово)
     historyEntry.exercises[i].note         : string  — то же поле в архиве
   Legacy: у старых черновиков заметки лежали в sets[j].note — при открытии модалки они
   собираются в одно общее поле, а при сохранении удаляются из подходов. */
'use strict';

const NOTE_MODAL_ID = 'set-note-modal';
const NOTE_MAX_LEN = 300;          // жёсткий лимит: заметки уходят в localStorage вместе с историей

// ---------- helpers ----------
// Текст общего комментария: ex.note, либо (для старых черновиков) заметки подходов через «; ».
function getExerciseNote(ex) {
    if (!ex) return '';
    if (typeof ex.note === 'string' && ex.note.trim()) return ex.note;
    const legacy = (ex.sets || [])
        .map(function (s, i) { return s && s.note ? 'Подход ' + (i + 1) + ': ' + s.note : null; })
        .filter(Boolean);
    return legacy.join('; ');
}

// ---------- modal (view) ----------
function openSetNoteModal(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    closeSetNoteModal();                       // одна модалка за раз

    const sets = ex.sets || [];
    const doneCount = sets.filter(function (s) { return s.weight > 0 && s.reps > 0; }).length;
    const note = getExerciseNote(ex);

    const modal = document.createElement('div');
    modal.id = NOTE_MODAL_ID;
    modal.className = 'modal-backdrop';
    modal.innerHTML =
        '<div class="modal-sheet">' +
            '<div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-4"></div>' +
            '<h2 class="text-xl font-bold mb-1 leading-snug break-words">' + escHtml(ex.name) + '</h2>' +
            '<p class="text-tgHint text-xs mb-4">' + sets.length + ' подх. · ' + doneCount + ' выполнено · ощущения</p>' +
            '<label class="section-label">Комментарий</label>' +
            '<textarea id="note-input" maxlength="' + NOTE_MAX_LEN + '" rows="4"' +
                ' class="note-textarea w-full text-sm mb-5" placeholder="Ощущения от упражнения…">' + escHtml(note) + '</textarea>' +
            '<button data-action="note-save" data-payload="' + exIdx + '" class="btn btn-primary"><i class="fa-solid fa-check"></i> Сохранить</button>' +
            '<button data-action="note-skip" data-payload="' + exIdx + '" class="btn btn-secondary mt-3">Пропустить</button>' +
        '</div>';

    document.body.appendChild(modal);
    const ta = document.getElementById('note-input');
    if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
    // клик по затемнению = закрыть (без потери ввода: заметка читается из textarea только при «Сохранить»)
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSetNoteModal(); });
    haptic('light');
}

function closeSetNoteModal() { const m = document.getElementById(NOTE_MODAL_ID); if (m) m.remove(); }

// ---------- controller ----------
// Сохранить: пишем общий комментарий в стейт активной тренировки + помечаем упражнение завершённым.
function saveSetNotes(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) { closeSetNoteModal(); return; }
    const ta = document.getElementById('note-input');
    const v = String((ta && ta.value) || '').trim().slice(0, NOTE_MAX_LEN);
    if (v) ex.note = v; else delete ex.note;
    (ex.sets || []).forEach(function (s) { if (s && s.note) delete s.note; });   // legacy-заметки больше не нужны
    ex.completed = true;                     // «ощущения внесены» — сохраняется в историю (data-management)
    saveActiveWorkout();                     // заметка живёт в state.activeWorkout → restore её вернёт
    closeSetNoteModal();
    haptic('success');
    updateExerciseCardInDOM(exIdx, ex);
}

function skipSetNotes(exIdx) {
    // «Пропустить» только закрывает модалку: состояние упражнения не меняем,
    // иначе ранее сохранённая заметка терялась бы при случайном нажатии.
    closeSetNoteModal();
    haptic('light');
}
