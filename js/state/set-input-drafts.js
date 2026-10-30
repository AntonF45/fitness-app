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

function clearAllSetDrafts() { Object.keys(setDrafts).forEach(function (k) { delete setDrafts[k]; }); }

// Значение поля подхода для отображения: черновик (введено, но не подтверждено)
// важнее данных; пустой черновик означает «пользователь стёр значение».
function effectiveSetValue(setId, field, setData) {
    const d = getSetDraft(setId, field);
    if (d !== null) return d;
    return (setData === null || typeof setData === 'undefined') ? '' : String(setData);
}

// Вызывается при загрузке страницы: если тренировка была восстановлена из
// localStorage, её прежние незакрытые черновики уже неактуальны.
function resetSetDraftsOnLoad() { clearAllSetDrafts(); }
