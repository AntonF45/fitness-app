/* state/set-input-drafts.js — незакрытые (не подтверждённые blur'ом) значения полей
   веса/повторов хранятся в памяти, а не только в DOM: перерисовка карточки обязана
   их сохранять и переносить вместе с подходами. */
'use strict';

const setDrafts = {};

function draftKey(exIdx, setIdx, field) { return exIdx + ':' + setIdx + ':' + field; }

function saveSetDraft(exIdx, setIdx, field, value) {
    const k = draftKey(exIdx, setIdx, field);
    if (value === '' || value === null || typeof value === 'undefined') { delete setDrafts[k]; return; }
    setDrafts[k] = String(value);
}

function getSetDraft(exIdx, setIdx, field) {
    const v = setDrafts[draftKey(exIdx, setIdx, field)];
    return (typeof v === 'string' && v !== '') ? v : null;
}

// Черновики привязаны к индексам подходов; при splice индексы сдвигаются,
// поэтому их перестраивает removeSet (clear + посев заново из state).

function clearSetDraftsForExercise(exIdx) {
    Object.keys(setDrafts).forEach(function (k) {
        if (String(k).indexOf(exIdx + ':') === 0) delete setDrafts[k];
    });
}

function clearAllSetDrafts() { Object.keys(setDrafts).forEach(function (k) { delete setDrafts[k]; }); }

// Черновик важнее данных: пустая строка означает «пользователь стёр значение».
function effectiveSetValue(exIdx, setIdx, field, setData) {
    const d = getSetDraft(exIdx, setIdx, field);
    if (d !== null) return d;
    return (setData === null || typeof setData === 'undefined') ? '' : String(setData);
}

function applySetDraftsToInputs(exIdx) {
    Object.keys(setDrafts).forEach(function (k) {
        const p = k.split(':');
        if (parseInt(p[0], 10) !== exIdx) return;
        const el = document.getElementById('set-' + p[0] + '-' + p[1] + '-' + p[2]);
        if (el) el.value = setDrafts[k];
    });
}

// Вызывается при загрузке страницы: если тренировка была восстановлена из
// localStorage, её прежние незакрытые черновики уже неактуальны.
function resetSetDraftsOnLoad() { clearAllSetDrafts(); }
