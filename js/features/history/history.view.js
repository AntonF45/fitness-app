/* features/history/history.view.js — экраны истории: список тренировок и детальный просмотр. */
'use strict';

// ── История: вспомогательные функции оформления ──────────────────────────
var HISTORY_PALETTE = ['blue', 'purple', 'green', 'orange', 'cyan'];
// Стабильный «цвет» программы по хешу названия — одна программа всегда одного цвета
function programColor(name) { var h = 0; var s = String(name || ''); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return HISTORY_PALETTE[h % HISTORY_PALETTE.length]; }
function formatDuration(sec) { var m = Math.round((Number(sec) || 0) / 60); if (m < 60) return m + ' мин'; var hh = Math.floor(m / 60), mm = m % 60; return mm ? hh + ' ч ' + mm + ' мин' : hh + ' ч'; }
function relativeDayLabel(dateStr) { var d = new Date(dateStr); var today = new Date(); var yest = new Date(); yest.setDate(today.getDate() - 1); var sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }; if (sameDay(d, today)) return 'Сегодня'; if (sameDay(d, yest)) return 'Вчера'; return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }); }
function entryStats(entry) { var tonnage = 0, sets = 0, reps = 0, exCount = (entry.exercises || []).length; (entry.exercises || []).forEach(function (ex) { (ex.sets || []).forEach(function (s) { var w = Number(s.weight) || 0, r = Number(s.reps) || 0; if (w > 0 && r > 0) { tonnage += w * r; sets++; reps += r; } }); }); return { tonnage: tonnage, sets: sets, reps: reps, exCount: exCount }; }

function renderHistory() {
    const history = DataAPI.getHistory().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    // Сводка: тренировки, суммарный объём, средний объём, серия дней подряд
    var totalTonnage = 0, totalDuration = 0;
    history.forEach(function (e) { totalTonnage += entryStats(e).tonnage; totalDuration += Number(e.duration) || 0; });
    var streak = 0;
    (function () { var byDay = {}; history.forEach(function (e) { var d = new Date(e.date); byDay[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = true; }); var cur = new Date(); if (!byDay[cur.getFullYear() + '-' + cur.getMonth() + '-' + cur.getDate()]) { cur.setDate(cur.getDate() - 1); } while (byDay[cur.getFullYear() + '-' + cur.getMonth() + '-' + cur.getDate()]) { streak++; cur.setDate(cur.getDate() - 1); } })();
    var summaryHTML = history.length ? '<div class="hist-summary card-enter">' +
        '<div class="hist-stat blue"><div class="hist-stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="hist-stat-value">' + history.length + '</div><div class="hist-stat-label">тренировок</div></div>' +
        '<div class="hist-stat purple"><div class="hist-stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div><div class="hist-stat-value">' + (totalTonnage / 1000).toFixed(1) + '<span class="hist-stat-unit">т</span></div><div class="hist-stat-label">общий объём</div></div>' +
        '<div class="hist-stat cyan"><div class="hist-stat-icon"><i class="fa-regular fa-stopwatch"></i></div><div class="hist-stat-value">' + Math.round(totalDuration / 60 / history.length) + '<span class="hist-stat-unit">мин</span></div><div class="hist-stat-label">средняя</div></div>' +
        '<div class="hist-stat orange"><div class="hist-stat-icon"><i class="fa-solid fa-fire"></i></div><div class="hist-stat-value">' + streak + '</div><div class="hist-stat-label">' + (streak === 1 ? 'день подряд' : streak >= 2 && streak <= 4 ? 'дня подряд' : 'дней подряд') + '</div></div>' +
        '</div>' : '';
    const listHTML = history.length ? history.map(function (entry, idx) { var st = entryStats(entry); var color = programColor(entry.programName); var dateStr = relativeDayLabel(entry.date); return '<div data-action="history-detail" data-payload="' + escAttr(entry.id) + '" class="hist-card app-card mb-3 active:scale-[0.98] transition-transform cursor-pointer card-enter" style="animation-delay: ' + (idx * 0.05) + 's">' +
        '<div class="hist-date-chip ' + color + '"><div class="day">' + new Date(entry.date).getDate() + '</div><div class="mon">' + new Date(entry.date).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') + '</div></div>' +
        '<div class="hist-card-body"><div class="flex justify-between items-start mb-1.5 gap-2"><div class="font-semibold text-base min-w-0 truncate">' + escHtml(entry.programName) + '</div><div class="hist-card-day text-tgHint text-xs whitespace-nowrap pt-0.5">' + escHtml(dateStr) + '</div></div>' +
        '<div class="hist-tags"><span class="hist-tag blue"><i class="fa-regular fa-clock"></i> ' + formatDuration(entry.duration) + '</span><span class="hist-tag green"><i class="fa-solid fa-layer-group"></i> ' + st.sets + '</span><span class="hist-tag purple"><i class="fa-solid fa-repeat"></i> ' + st.reps + '</span><span class="hist-tag orange"><i class="fa-solid fa-weight-hanging"></i> ' + (st.tonnage / 1000).toFixed(1) + ' т</span></div></div>' +
        '<i class="fa-solid fa-chevron-right hist-card-arrow"></i></div>'; }).join('') : '<div class="empty-state-block card-enter"><i class="fa-solid fa-clock-rotate-left"></i><div class="title">История пуста</div><div class="desc">Завершите первую тренировку — она появится здесь.</div></div>';
    const label = history.length ? '<div class="section-label">История · ' + history.length + '</div>' : '';
    document.getElementById('app-content').innerHTML = summaryHTML + (history.length ? '<div class="section-label" style="margin-top:16px">Тренировки</div>' : '') + listHTML +
        '<div style="height: 110px"></div>' +
        '<div class="sticky-bottom-action"><button data-action="open-data-menu" class="btn btn-secondary"><i class="fa-solid fa-gear"></i> Управление данными</button></div>';
}
function renderHistoryDetail(entryId) {
    const entry = DataAPI.getHistoryEntryById(entryId);
    if (!entry) { document.getElementById('app-content').innerHTML = '<div class="empty-state-block"><i class="fa-solid fa-magnifying-glass"></i><div class="title">Не найдено</div><div class="desc">Запись тренировки отсутствует или была удалена.</div></div>'; return; }
    const date = new Date(entry.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let tonnage = 0; (entry.exercises || []).forEach(function (ex) { (ex.sets || []).forEach(function (s) { tonnage += (Number(s.weight) || 0) * (Number(s.reps) || 0); }); });
    const exercises = entry.exercises || []; const allSsIds = exercises.map(function (e) { return e.supersetId; });
    const groups = []; const processed = new Set();
    exercises.forEach(function (ex, idx) { if (processed.has(idx)) return; if (ex.supersetId) { const group = exercises.map(function (e, i) { e = Object.assign({}, e); e.originalIndex = i; return e; }).filter(function (e) { return e.supersetId === ex.supersetId; }); group.forEach(function (e) { processed.add(e.originalIndex); }); groups.push({ type: 'superset', exercises: group }); } else { processed.add(idx); groups.push({ type: 'single', exercise: ex, originalIndex: idx }); } });
    const renderDetail = function (ex) { const isBw = ex.exerciseType === 'bodyweight'; const setsHTML = (ex.sets || []).map(function (s, i) { return '<div class="py-2 border-b border-tgBg last:border-0 ' + (s.setType === 'drop' ? 'text-orange-400' : '') + '"><div class="flex justify-between"><span class="text-tgHint text-sm flex items-center gap-2">' + (i + 1) + '.' + (s.setType === 'drop' ? '<span class="drop-badge"><i class="fa-solid fa-fire"></i> ДРОП</span>' : '') + '</span><span class="font-medium">' + s.weight + ' кг × ' + s.reps + ' повт</span></div></div>'; }).join(''); const exNote = (typeof ex.note === 'string' && ex.note.trim()) ? ex.note.trim() : ((ex.sets || []).filter(function (s) { return s && s.note; }).map(function (s, i) { return 'Подход ' + (i + 1) + ': ' + s.note; }).join('; ')); const noteBlock = exNote ? '<div class="set-note exercise-note mt-2"><i class="fa-solid fa-comment-dots"></i> ' + escHtml(exNote) + '</div>' : ''; return '<div class="mb-4"><div class="flex items-center gap-2 mb-2 flex-wrap"><h3 class="font-bold text-base">' + escHtml(ex.name) + '</h3>' + (isBw ? '<span class="bodyweight-badge">Собственный вес</span>' : '') + '</div><div class="app-inset p-4 text-sm">' + setsHTML + noteBlock + '</div></div>'; };
    const exHTML = groups.map(function (g) { if (g.type === 'superset') { const style = getSupersetStyle(g.exercises[0].supersetId, allSsIds); return '<div class="app-inset p-3 mb-4" style="' + style.styleAttr + '"><div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold mb-3 uppercase tracking-wide" style="' + style.badgeStyle + '"><i class="fa-solid fa-bolt"></i> СУПЕРСЕТ</div>' + g.exercises.map(renderDetail).join('') + '</div>'; } return renderDetail(g.exercise); }).join('');
    var dst = entryStats(entry);
    var dcolor = programColor(entry.programName);
    var headHTML = '<div class="hist-detail-head card-enter ' + dcolor + '">' +
        '<h2 class="hist-detail-title">' + escHtml(entry.programName) + '</h2>' +
        '<p class="hist-detail-date"><i class="fa-regular fa-calendar mr-1"></i>' + date + '</p>' +
        '<div class="hist-detail-stats">' +
        '<div class="hist-detail-stat"><div class="v blue"><i class="fa-regular fa-clock"></i> ' + formatDuration(entry.duration) + '</div><div class="l">длительность</div></div>' +
        '<div class="hist-detail-stat"><div class="v green"><i class="fa-solid fa-layer-group"></i> ' + dst.sets + '</div><div class="l">подходов</div></div>' +
        '<div class="hist-detail-stat"><div class="v purple"><i class="fa-solid fa-repeat"></i> ' + dst.reps + '</div><div class="l">повторов</div></div>' +
        '<div class="hist-detail-stat"><div class="v orange"><i class="fa-solid fa-weight-hanging"></i> ' + (dst.tonnage / 1000).toFixed(1) + ' т</div><div class="l">объём</div></div>' +
        '</div></div>';
    document.getElementById('app-content').innerHTML = headHTML + exHTML;
}
