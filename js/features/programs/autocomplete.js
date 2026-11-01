/* features/programs/autocomplete.js — виджет автоподбора названий упражнений и групп мышц.
   Работает поверх input с классами .exercise-name-input / .muscle-input (scope editor|workout).
   Также содержит общий виджет «крестика» очистки (.clearable) для текстовых полей. */
'use strict';

// === Кнопка очистки текста (крестик, как в строке поиска браузера) ===
const AC_CLEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';

function updateClearButton(inputEl) {
    const wrap = inputEl.closest('.ac-wrapper');
    if (!wrap) return;
    let btn = wrap.querySelector('.input-clear-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'input-clear-btn';
        btn.setAttribute('aria-label', 'Очистить');
        btn.dataset.action = 'ac-clear';
        btn.innerHTML = AC_CLEAR_SVG;
        wrap.appendChild(btn);
    }
    // Показываем крестик только когда в поле есть текст; синхронизируем позицию со скроллом текста.
    btn.style.display = inputEl.value ? '' : 'none';
    btn.style.right = Math.max(10, 10 - inputEl.scrollLeft) + 'px';
}

function clearInputByAction(target) {
    const wrap = target.closest('.ac-wrapper');
    const input = wrap ? wrap.querySelector('input') : null;
    if (!input) return;
    // Не даём focusout от клика по кнопке закрыть подсказки раньше времени.
    if (target.hasAttribute('data-action')) target.setAttribute('data-action', '');
    target.blur();
    input.value = '';
    target.style.display = 'none';
    // Обновляем состояние так же, как при обычном вводе текста.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true });
}

function initClearButtons(root) {
    root.querySelectorAll('input.clearable').forEach(updateClearButton);
}

// Делегирование: показ/скрытие крестика при вводе, фокусе и потере фокуса.
document.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('input.clearable')) updateClearButton(e.target);
}, true);
document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches('input.clearable')) updateClearButton(e.target);
});
document.addEventListener('focusout', function (e) {
    if (!(e.target.matches && e.target.matches('input.clearable'))) return;
    const input = e.target;
    setTimeout(function () {
        // Прячем крестик, только если фокус ушёл не на него и не в это же поле.
        const active = document.activeElement;
        if (active === input || (active && active.classList && active.classList.contains('input-clear-btn'))) return;
        if (!input.value) {
            const btn = input.closest('.ac-wrapper') ? input.closest('.ac-wrapper').querySelector('.input-clear-btn') : null;
            if (btn) btn.style.display = 'none';
        }
    }, 150);
});
document.addEventListener('scroll', function (e) {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.classList.contains('clearable')) updateClearButton(t);
}, true);

function getAutocompleteSuggestions(query, limit, muscleGroup) {
    const q = (query || '').trim().toLowerCase();
    let all = DataAPI.getUserExercises();
    if (muscleGroup) all = all.filter(function (ex) { return ex.muscleGroup === muscleGroup; });
    if (!q) return all.slice(0, limit || 8);
    return all.filter(function (ex) { const n = ex.name.toLowerCase(); return n.includes(q) && n !== q; }).slice(0, limit || 8);
}
function getMuscleSuggestions(query) {
    const q = (query || '').trim().toLowerCase();
    const groups = getMuscleGroups();
    if (!q) return groups.slice(0, 12);
    return groups.filter(function (g) { return g.toLowerCase().includes(q); }).slice(0, 12);
}
function hideAllAutocomplete() {
    document.querySelectorAll('.autocomplete-dropdown').forEach(function (d) { d.style.display = 'none'; d.innerHTML = ''; });
}
function hideAllAutocompleteExcept(keepDrop) {
    document.querySelectorAll('.autocomplete-dropdown').forEach(function (d) {
        if (d !== keepDrop) { d.style.display = 'none'; d.innerHTML = ''; }
    });
}
function updateAutocomplete(inputEl) {
    const scope = inputEl.dataset.scope || 'editor';
    const index = inputEl.dataset.exerciseIndex || '0';
    const drop = document.getElementById('ac-drop-' + scope + '-' + index);
    if (!drop) return;
    // Подсказки должны быть активны только у одного поля: прячем чужие дропдауны.
    hideAllAutocompleteExcept(drop);
    let group = '';
    if (scope === 'editor') {
        const ex = state.editingProgram && state.editingProgram.exercises ? state.editingProgram.exercises[parseInt(index, 10)] : null;
        group = ex ? (ex.muscleGroup || '') : '';
    } else {
        const g = document.getElementById('add-ex-group');
        group = g ? (g.value || '') : '';
    }
    const suggestions = getAutocompleteSuggestions(inputEl.value, 8, group);
    if (!suggestions.length) { drop.style.display = 'none'; drop.innerHTML = ''; return; }
    drop.innerHTML = suggestions.map(function (s) {
        return '<div class="autocomplete-item" data-action="ac-pick" data-scope="' + scope + '" data-index="' + index + '" data-name="' + escAttr(s.name) + '"><div>' + escHtml(s.name) + '</div>' + (group ? '' : '<div class="ac-group">' + escHtml(s.muscleGroup) + '</div>') + '</div>';
    }).join('');
    drop.style.display = 'block';
}
function updateMuscleAutocomplete(inputEl) {
    const scope = inputEl.dataset.scope || 'editor';
    const index = inputEl.dataset.exerciseIndex || '0';
    const drop = document.getElementById('ac-drop-muscle-' + scope + '-' + index);
    if (!drop) return;
    // Подсказки должны быть активны только у одного поля: прячем чужие дропдауны.
    hideAllAutocompleteExcept(drop);
    const suggestions = getMuscleSuggestions(inputEl.value);
    if (!suggestions.length) { drop.style.display = 'none'; drop.innerHTML = ''; return; }
    drop.innerHTML = suggestions.map(function (g) {
        return '<div class="autocomplete-item" data-action="ac-muscle-pick" data-scope="' + scope + '" data-index="' + index + '" data-name="' + escAttr(g) + '"><div>' + escHtml(g) + '</div></div>';
    }).join('');
    drop.style.display = 'block';
}
function pickAutocomplete(target) {
    const scope = target.dataset.scope;
    const name = target.dataset.name;
    const suggestion = DataAPI.getUserExercises().find(function (ex) { return ex.name === name; });
    if (scope === 'editor') {
        const index = parseInt(target.dataset.index, 10);
        const ex = state.editingProgram && state.editingProgram.exercises ? state.editingProgram.exercises[index] : null;
        if (ex) { ex.name = name; if (!ex.muscleGroup && suggestion) ex.muscleGroup = suggestion.muscleGroup; }
        hideAllAutocomplete();
        renderProgramEdit();
    } else {
        const input = document.getElementById('add-ex-name');
        if (input) input.value = name;
        const sel = document.getElementById('add-ex-group');
        if (sel && suggestion && suggestion.muscleGroup) sel.value = suggestion.muscleGroup;
        hideAllAutocomplete();
    }
    haptic('light');
}
function pickMuscleAutocomplete(target) {
    const scope = target.dataset.scope || 'editor';
    const index = target.dataset.index || '0';
    const name = target.dataset.name;
    const input = document.querySelector('.muscle-input[data-scope="' + scope + '"][data-exercise-index="' + index + '"]');
    if (input) input.value = name;
    if (scope === 'editor') updateExercise(parseInt(index, 10), 'muscleGroup', name);
    hideAllAutocomplete();
    haptic('light');
}
