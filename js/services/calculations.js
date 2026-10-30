/* services/calculations.js — доменная логика: даты, периоды, фильтры истории, оценка 1ПМ.
   Чистые вычисления поверх DataAPI/state, без генерации HTML. */
'use strict';

function formatLocalDateKey(date) { const d = date instanceof Date ? date : new Date(date); if (isNaN(d.getTime())) return null; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function formatLocalMonthKey(date) { const d = date instanceof Date ? date : new Date(date); if (isNaN(d.getTime())) return null; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function getWeekStart(date) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d; }
function isValidSetRecord(rec) { if (!rec) return false; const w = Number(rec.weight), r = Number(rec.reps); if (!isFinite(w) || !isFinite(r) || w < 0 || r < 0) return false; return w > 0 && r > 0; }
function estimate1RM(weight, reps) { const w = Number(weight), r = Number(reps); if (!isFinite(w) || !isFinite(r) || w <= 0 || r <= 0) return 0; if (r === 1) return w; if (r <= 10) return w * (1 + r / 30); if (r <= 20) return w * (36 / (37 - r)); return 0; }
function getExerciseTypeByName(name) {
    const programs = DataAPI.getPrograms();
    for (let i = 0; i < programs.length; i++) { const ex = (programs[i].exercises || []).find(function (e) { return e.name === name; }); if (ex) return ex.exerciseType || 'weighted'; }
    const history = DataAPI.getHistory();
    for (let j = 0; j < history.length; j++) { const ex = (history[j].exercises || []).find(function (e) { return e.name === name; }); if (ex) return ex.exerciseType || 'weighted'; }
    return 'weighted';
}
function getPeriodLabel() {
    if (state.selectedMonthKey) { const m = getAvailableMonthsForExercise(null).find(function (x) { return x.key === state.selectedMonthKey; }); return m ? m.label : 'месяц'; }
    return ({ week: '7 дней', month: '30 дней', quarter: '90 дней', all: 'всё время' })[state.selectedPeriod] || 'всё время';
}
function getFilteredHistory(history, period) {
    if (state.selectedMonthKey) return history.filter(function (item) { return formatLocalMonthKey(item.date) === state.selectedMonthKey; });
    if (period === 'all') return history;
    const now = new Date(); now.setHours(23, 59, 59, 999);
    let cutoff;
    if (period === 'week') cutoff = getWeekStart(now);
    else if (period === 'month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    else if (period === 'quarter') cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);
    else return history;
    return history.filter(function (item) { return new Date(item.date) >= cutoff; });
}
function getAvailableMonthsForExercise(exerciseName) {
    const monthSet = new Set();
    if (exerciseName) DataAPI.getExerciseHistory(exerciseName).forEach(function (h) { const key = formatLocalMonthKey(h.date); if (key) monthSet.add(key); });
    if (monthSet.size === 0) { const now = new Date(); for (let i = 0; i < 6; i++) monthSet.add(formatLocalMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 1))); }
    return Array.from(monthSet).sort(function (a, b) { return b.localeCompare(a); }).map(function (key) { const p = key.split('-'); return { key: key, label: MONTHS_RU[Number(p[1]) - 1] + ' ' + p[0] }; });
}
