/* features/workout/set-note-modal.js — всплывающее окно «ощущения» после завершения упражнения.

   Архитектурное место: слой features/workout (view + controller одного фичевого блока).
   - НЕ работает с localStorage напрямую: заметка живёт в state.activeWorkout и сохраняется
     через saveActiveWorkout(); при завершении тренировки её забирает workout-exit-modal.js
     и кладёт в sets[].note записи истории (DataAPI.saveHistory);
   - НЕ навешивает onclick сам: все клики идут через data-action → ui/event-delegation.js;
   - НЕ перерисовывает экран целиком: только свою карточку через updateExerciseCardInDOM().

   Модель данных (поле опционально — старые черновики/записи без note работают как раньше):
     activeWorkout.exercises[i].sets[j].note : string  — текст ощущения подхода
     activeWorkout.exercises[i].completed    : boolean — «ощущения внесены» (бейдж ✓ Готово)
     historyEntry.exercises[i].sets[j].note  : string  — то же поле в архиве */
'use strict';

const NOTE_MODAL_ID = 'set-note-modal';
const NOTE_MAX_LEN = 300;          // жёсткий лимит: заметки уходят в localStorage вместе с историей
const NOTE_DEFAULT_LABELS = ['Легко', 'Нормально', 'Тяжело'];
const NOTE_EXTRA_LABELS = ['Устал', 'Отлично', 'Плохо выспался'];

// ---------- helpers ----------
function _num(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }

function formatSetLabel(set) {
    if (!set) return '';
    if (set.setType === 'drop') return 'Дроп-подход · ' + _num(set.weight) + ' кг × ' + _num(set.reps);
    return _num(set.weight) + ' кг × ' + _num(set.reps) + ' повт';
}

// Средний/последний рабочий вес и повторения упражнения — используются как плейсхолдеры подсказок.
function exerciseStats(ex) {
    const done = (ex && ex.sets ? ex.sets : []).filter(function (s) { return s.weight > 0 && s.reps > 0; });
    if (!done.length) return { weight: null, reps: ex ? (ex.targetReps ?? 10) : 10 };
    const last = done[done.length - 1];
    return { weight: _num(last.weight), reps: _num(last.reps) };
}

// Подсказки «ощущений»: быстрые шаблоны, чтобы пользователь не печатал с телефона руками.
function buildNoteSuggestions(ex) {
    const st = exerciseStats(ex);
    const w = st.weight !== null ? st.weight : '?';
    const r = st.reps || '?';
    const bw = ex && ex.exerciseType === 'bodyweight';
    const list = [
        bw ? 'Последние повторы — на максимум' : 'Вес был комфортным',
        bw ? 'Работалось легко, можно добавить вес' : 'Можно было взять ' + (w === '?' ? 'больше' : (_num(w) + 5) + ' кг'),
        'Отдых между подходами был коротким',
        'Суставы/локти не беспокоили',
        r !== '?' ? 'К последним ' + r + ' повторам темп просел' : 'Темп к концу подхода просел',
        'Помнила техника, но корпус гулял',
        'Сегодняшнее состояние — 8/10'
    ];
    return list.slice(0, 6);
}

// ---------- modal (view) ----------
function openSetNoteModal(exIdx, focusSetIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) return;
    closeSetNoteModal();                       // одна модалка за раз

    const sets = ex.sets || [];
    const rowsHTML = sets.map(function (s, i) {
        const note = String(s.note || '');
        return '<div class="app-inset p-3 mb-2" id="note-row-' + i + '">' +
            '<div class="flex items-center justify-between gap-2 mb-2">' +
                '<span class="text-tgHint text-xs font-medium uppercase tracking-wide">Подход ' + (i + 1) + '</span>' +
                '<span class="text-xs font-semibold">' + escHtml(formatSetLabel(s)) + '</span>' +
            '</div>' +
            '<textarea id="note-input-' + i + '" maxlength="' + NOTE_MAX_LEN + '" rows="2" data-set="' + i + '"' +
                ' class="note-textarea w-full text-sm" placeholder="Ощущения от подхода…">' + escHtml(note) + '</textarea>' +
        '</div>';
    }).join('');

    const suggestionsHTML = buildNoteSuggestions(ex).map(function (t) {
        return '<button type="button" data-action="note-suggestion" data-payload="' + escAttr(t) + '" class="chip-btn">' + escHtml(t) + '</button>';
    }).join('');

    const rpeHTML = NOTE_DEFAULT_LABELS.map(function (t, i) {
        return '<button type="button" data-action="note-rpe" data-payload="' + i + '" class="chip-btn">' + escHtml(t) + '</button>';
    }).join('') + '<button type="button" data-action="note-rpe-more" class="chip-btn chip-add"><i class="fa-solid fa-plus"></i></button>';

    const modal = document.createElement('div');
    modal.id = NOTE_MODAL_ID;
    modal.className = 'modal-backdrop';
    modal.innerHTML =
        '<div class="modal-sheet">' +
            '<div class="w-10 h-1 bg-tgHint/40 rounded-full mx-auto mb-4"></div>' +
            '<h2 class="text-xl font-bold mb-1 leading-snug break-words">' + escHtml(ex.name) + '</h2>' +
            '<p class="text-tgHint text-xs mb-4">' + (sets.length) + ' подх. · ' +
                ((sets.filter(function (s) { return s.weight > 0 && s.reps > 0; })).length) + ' выполнено · ощущения</p>' +
            '<label class="section-label">Заметки по подходам</label>' +
            '<div class="mb-4 max-h-[40vh] overflow-y-auto -mx-1 px-1">' + (rowsHTML || '<div class="text-tgHint text-sm mb-4">Подходов пока нет.</div>') + '</div>' +
            '<label class="section-label">Быстрые подсказки</label>' +
            '<div class="chips-row mb-4">' + suggestionsHTML + '</div>' +
            '<label class="section-label">Общая оценка (RPE)</label>' +
            '<div class="chips-row mb-5" id="note-rpe-row">' + rpeHTML + '</div>' +
            '<button data-action="note-save" data-payload="' + exIdx + '" class="btn btn-primary"><i class="fa-solid fa-check"></i> Сохранить</button>' +
            '<button data-action="note-skip" data-payload="' + exIdx + '" class="btn btn-secondary mt-3">Пропустить</button>' +
        '</div>';

    document.body.appendChild(modal);
    // Если пришли из контекстного меню конкретного подхода — фокус сразу в его поле
    const fi = parseInt(focusSetIdx, 10);
    if (!isNaN(fi)) {
        const ta = document.getElementById('note-input-' + fi);
        if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
    }
    // клик по затемнению = закрыть (без потери ввода: заметки читаются из textarea только при «Сохранить»)
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSetNoteModal(); });
    haptic('light');
}

function closeSetNoteModal() { const m = document.getElementById(NOTE_MODAL_ID); if (m) m.remove(); }

// Собирает текст из активного textarea (или последнего visible) — для вставки подсказок.
function _activeNoteTextarea() {
    const focused = document.activeElement;
    if (focused && focused.classList && focused.classList.contains('note-textarea')) return focused;
    const all = document.querySelectorAll('#' + NOTE_MODAL_ID + ' .note-textarea');
    return all.length ? all[all.length - 1] : null;
}

function appendNoteSuggestion(text) {
    const ta = _activeNoteTextarea();
    if (!ta) { showAlert('Откройте поле заметки'); return; }
    const cur = ta.value.trim();
    const next = cur ? cur + '; ' + text : text;
    ta.value = next.slice(0, NOTE_MAX_LEN);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    haptic('light');
}

// RPE-чип проставляет одинаковую оценку во все непустые подходы (быстрый ввод одной кнопкой).
function applyRpeToSets(label) {
    const tas = document.querySelectorAll('#' + NOTE_MODAL_ID + ' .note-textarea');
    let touched = 0;
    Array.prototype.forEach.call(tas, function (ta) {
        const cur = ta.value.trim();
        if (!cur) { ta.value = label; touched++; return; }
        if (cur.indexOf(label) !== -1) return;
        ta.value = (cur + '; ' + label).slice(0, NOTE_MAX_LEN);
        touched++;
    });
    if (!touched) showAlert('Нет подходов для оценки');
    haptic('light');
}

function revealMoreRpe() {
    const extra = NOTE_EXTRA_LABELS;
    const row = document.getElementById('note-rpe-row');
    if (!row) return;
    const more = row.querySelector('[data-action="note-rpe-more"]');
    extra.forEach(function (t) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip-btn';
        b.dataset.action = 'note-rpe'; b.dataset.payload = t;
        b.textContent = t;
        if (more) row.insertBefore(b, more); else row.appendChild(b);
    });
    if (more) more.remove();
    haptic('light');
}

// ---------- controller ----------
// Сохранить: пишем заметки в стейт активной тренировки + помечаем упражнение завершённым.
function saveSetNotes(exIdx) {
    const ex = state.activeWorkout && state.activeWorkout.exercises ? state.activeWorkout.exercises[exIdx] : null;
    if (!ex) { closeSetNoteModal(); return; }
    const tas = document.querySelectorAll('#' + NOTE_MODAL_ID + ' .note-textarea');
    Array.prototype.forEach.call(tas, function (ta) {
        const i = parseInt(ta.dataset.set, 10);
        if (!isNaN(i) && ex.sets[i]) {
            const v = String(ta.value || '').trim().slice(0, NOTE_MAX_LEN);
            if (v) ex.sets[i].note = v; else delete ex.sets[i].note;
        }
    });
    ex.completed = true;                     // «ощущения внесены» — сохраняется в историю (data-management)
    saveActiveWorkout();                     // заметки живут в state.activeWorkout → restore их вернёт
    closeSetNoteModal();
    haptic('success');
    updateExerciseCardInDOM(exIdx, ex);
}

function skipSetNotes(exIdx) {
    // «Пропустить» только закрывает модалку: состояние упражнения не меняем,
    // иначе ранее сохранённые заметки/флаг терялись бы при случайном нажатии.
    closeSetNoteModal();
    haptic('light');
}
