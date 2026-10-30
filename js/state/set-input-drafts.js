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

// Сдвиг ключей при splice: черновик подхода N после удаления M<N переходит на N-1.
function shiftSetDraftsAfterRemoval(exIdx, removedIdx) {
    Object.keys(setDrafts).forEach(function (k) {
        const p = k.split(':');
        if (parseInt(p[0], 10) !== exIdx) return;
        const sIdx = parseInt(p[1], 10);
        if (sIdx === removedIdx) { delete setDrafts[k]; return; }
        if (sIdx > removedIdx) setDrafts[p[0] + ':' + (sIdx - 1) + ':' + p[2]] = setDrafts[k], delete setDrafts[k];
    });
}

// Сдвиг ключей при вставке/добавлении подхода.
function shiftSetDraftsAfterInsertion(exIdx, insertedIdx) {
    Object.keys(setDrafts).slice().reverse().forEach(function (k) {
        const p = k.split(':');
        if (parseInt(p[0], 10) !== exIdx) return;
        const sIdx = parseInt(p[1], 10);
        if (sIdx >= insertedIdx) setDrafts[p[0] + ':' + (sIdx + 1) + ':' + p[2]] = setDrafts[k], delete setDrafts[k];
    });
}

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
