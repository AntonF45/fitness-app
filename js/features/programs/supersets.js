/* features/programs/supersets.js — доменная логика суперсетов: цвета, подсчёт участников,
   нормализация (роспуск групп из <2 упражнений), нумерация. */
'use strict';

const SUPERSET_COLORS = [{ border: '#a855f7', bg: 'rgba(168,85,247,0.08)', badgeBg: 'rgba(168,85,247,0.25)', text: '#c084fc' }, { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', badgeBg: 'rgba(59,130,246,0.25)', text: '#60a5fa' }, { border: '#10b981', bg: 'rgba(16,185,129,0.08)', badgeBg: 'rgba(16,185,129,0.25)', text: '#34d399' }, { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', badgeBg: 'rgba(245,158,11,0.25)', text: '#fbbf24' }, { border: '#ec4899', bg: 'rgba(236,72,153,0.08)', badgeBg: 'rgba(236,72,153,0.25)', text: '#f472b6' }];
function getSupersetStyle(supersetId, allSupersetIds) { if (!supersetId) return { styleAttr: '', badgeStyle: '', text: '#c084fc', border: '#a855f7' }; const unique = Array.from(new Set(allSupersetIds.filter(Boolean))); const c = SUPERSET_COLORS[unique.indexOf(supersetId) % SUPERSET_COLORS.length]; return { styleAttr: 'border-left: 4px solid ' + c.border + '; background: linear-gradient(90deg, ' + c.bg + ', transparent);', badgeStyle: 'background: ' + c.badgeBg + '; color: ' + c.text + ';', text: c.text, border: c.border }; }
function countSupersetMembers(exercises, ssId) { return (exercises || []).filter(function (e) { return e.supersetId === ssId; }).length; }
function dissolveSuperset(exercises, ssId) { (exercises || []).forEach(function (e) { if (e.supersetId === ssId) e.supersetId = null; }); }
function normalizeSupersets(exercises) {
    const ids = [];
    (exercises || []).forEach(function (e) { if (e.supersetId && ids.indexOf(e.supersetId) === -1) ids.push(e.supersetId); });
    ids.forEach(function (id) { if (countSupersetMembers(exercises, id) < 2) dissolveSuperset(exercises, id); });
}
function getSupersetNumber(ssId, exercises) {
    const ids = [];
    (exercises || []).forEach(function (e) { if (e.supersetId && ids.indexOf(e.supersetId) === -1) ids.push(e.supersetId); });
    const idx = ids.indexOf(ssId);
    return idx === -1 ? 0 : idx + 1;
}
