/* state/set-input-drafts.js — незакрытые (не подтверждённые blur'ом) значения полей
   веса/повторов хранятся в памяти, а не только в DOM: перерисовка карточки обязана
   их сохранять и переносить вместе с подходами. */
'use strict';

const setDrafts = {};

function draftKey(exId, field) { return exId + ':' + field; }

function saveSetDraft(exId, field, value) {
    const k = draftKey(exId, field);
    if (value === '' || value === null || typeof value === 'undefined') { delete setDrafts[k]; return; }
    setDrafts[k] = String(value);
}

function getSetDraft(exId, field) {
    const v = setDrafts[draftKey(exId, field)];
    return (typeof v === 'string' && v !== '') ? v : null;
}

function clearSetDraftsForExercise(exerciseId) {
    Object.keys(setDrafts).forEach(function (k) {
        if (String(k).indexOf(exerciseId + ':') === 0) delete setDrafts[k];
    });
}

function clearAllSetDrafts() { Object.keys(setDrafts).forEach(function (k) { delete setDrafts[k]; }); }

// Черновик важнее данных: пустая строка означает «пользователь стёр значение».
function effectiveSetValue(exId, field, setData) {
    const d = getSetDraft(exId, field);
    if (d !== null) return d;
    return (setData === null || typeof setData === 'undefined') ? '' : String(setData);
}

function applySetDraftsToInputs(exerciseId) {
    Object.keys(setDrafts).forEach(function (k) {
        const i = k.lastIndexOf(':');
        const exId = k.slice(0, i), field = k.slice(i + 1);
        if (exId !== exerciseId) return;
        const el = document.getElementById('set-' + exId + '-' + field);
        if (el) el.value = setDrafts[k];
    });
}

// Вызывается при загрузке страницы: если тренировка была восстановлена из
// localStorage, её прежние незакрытые черновики уже неактуальны.
function resetSetDraftsOnLoad() { clearAllSetDrafts(); }
