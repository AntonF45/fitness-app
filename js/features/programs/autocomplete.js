/* features/programs/autocomplete.js — виджет автоподбора названий упражнений и групп мышц.
   Работает поверх input с классами .exercise-name-input / .muscle-input (scope editor|workout). */
'use strict';

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
function updateAutocomplete(inputEl) {
    const scope = inputEl.dataset.scope || 'editor';
    const index = inputEl.dataset.exerciseIndex || '0';
    const drop = document.getElementById('ac-drop-' + scope + '-' + index);
    if (!drop) return;
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
