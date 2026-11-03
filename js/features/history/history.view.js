/* features/history/history.view.js — экраны истории: список тренировок и детальный просмотр. */
'use strict';

// ── История: вспомогательные функции оформления ──────────────────────────
var HISTORY_PALETTE = ['blue', 'purple', 'green', 'orange', 'cyan'];
// Стабильный «цвет» программы по хешу названия — одна программа всегда одного цвета
function programColor(name) { var h = 0; var s = String(name || ''); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return HISTORY_PALETTE[h % HISTORY_PALETTE.length]; }
// Цвет группы мышц (для акцентной полоски на карточке в списке)
function muscleGroupColor(g) { switch (String(g || '')) { case 'Грудь': return 'red'; case 'Спина': return 'blue'; case 'Ноги': return 'green'; case 'Плечи': return 'orange'; case 'Бицепс': return 'purple'; case 'Трицепс': return 'cyan'; case 'Пресс': return 'yellow'; default: return ''; } }
function entryMainMuscleGroup(entry) { var counts = {}; (entry.exercises || []).forEach(function (ex) { var g = ex.muscleGroup; if (g) counts[g] = (counts[g] || 0) + 1; }); var best = '', n = 0; Object.keys(counts).forEach(function (k) { if (counts[k] > n) { n = counts[k]; best = k; } }); return best; }
function declension(n, forms) { n = Number(n) || 0; var n10 = n % 10, n100 = n % 100; if (n10 === 1 && n100 !== 11) return forms[0]; if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1]; return forms[2]; }
// Топ групп мышц тренировки: [{name, count}], отсортировано по убыванию
function entryTopGroups(entry) { var counts = {}; (entry.exercises || []).forEach(function (ex) { var g = ex.muscleGroup; if (g) counts[g] = (counts[g] || 0) + 1; }); return Object.keys(counts).map(function (k) { return { name: k, count: counts[k] }; }).sort(function (a, b) { return b.count - a.count; }); }
// Мини-график активности за последние N дней (по 7 дней в столбике)
function histActivityBars(history, days) { days = days || 28; var byDay = {}; history.forEach(function (e) { var d = new Date(e.date); if (!isNaN(d)) byDay[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = true; }); var cells = [], today = new Date(); today.setHours(0, 0, 0, 0); for (var i = days - 1; i >= 0; i--) { var d = new Date(today); d.setDate(today.getDate() - i); var on = !!byDay[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()]; cells.push({ date: d, on: on, isToday: i === 0 }); } var cols = []; for (var j = 0; j < cells.length; j += 7) { var chunk = cells.slice(j, j + 7); var sum = 0; chunk.forEach(function (c) { if (c.on) sum++; }); cols.push({ cells: chunk, sum: sum }); } return cols; }
function formatDuration(sec) { var m = Math.round((Number(sec) || 0) / 60); if (m < 60) return m + ' мин'; var hh = Math.floor(m / 60), mm = m % 60; return mm ? hh + ' ч ' + mm + ' мин' : hh + ' ч'; }
function relativeDayLabel(dateStr) { var d = new Date(dateStr); var today = new Date(); var yest = new Date(); yest.setDate(today.getDate() - 1); var sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }; if (sameDay(d, today)) return 'Сегодня'; if (sameDay(d, yest)) return 'Вчера'; return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }); }
function entryStats(entry) { var tonnage = 0, sets = 0, reps = 0, exCount = (entry.exercises || []).length; (entry.exercises || []).forEach(function (ex) { (ex.sets || []).forEach(function (s) { var w = Number(s.weight) || 0, r = Number(s.reps) || 0; if (w > 0 && r > 0) { tonnage += w * r; sets++; reps += r; } }); }); return { tonnage: tonnage, sets: sets, reps: reps, exCount: exCount }; }

// Заголовок месяца в календаре: «ноябрь 2026 г.» — буква «г» строчная, с узким неразрывным пробелом
function formatCalMonthYear(d) { return d.toLocaleDateString('ru-RU', { month: 'long' }) + ' ' + d.getFullYear() + '\u202F\u0433.'; }

// Переключение месяца в календаре истории (dir = -1 / +1)
function histCalShift(dir) {
    var base = window._histCalMonth;
    if (base === undefined || base === null) { var t = new Date(); base = new Date(t.getFullYear(), t.getMonth(), 1).getTime(); }
    var d = new Date(base);
    d.setMonth(d.getMonth() + dir);
    window._histCalMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    renderHistory();
    haptic('light');
}

function renderHistory() {
    const history = DataAPI.getHistory().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    // Сводка: тренировки, суммарный объём, ср. вр. трен., трен. в мес.
    var totalTonnage = 0, totalDuration = 0;
    history.forEach(function (e) { totalTonnage += entryStats(e).tonnage; totalDuration += Number(e.duration) || 0; });
    // Среднее количество тренировок в месяц: считаем по уникальным месяцам, в которых были тренировки
    var perMonthAvg = 0;
    (function () { var monthSet = {}; history.forEach(function (e) { var d = new Date(e.date); if (!isNaN(d)) monthSet[d.getFullYear() + '-' + d.getMonth()] = true; }); var months = Object.keys(monthSet).length; if (months) perMonthAvg = Math.round(history.length / months * 10) / 10; })();
    var summaryHTML = history.length ? '<div class="hist-summary card-enter">' +
        '<div class="hist-stat blue"><div class="hist-stat-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="hist-stat-value">' + history.length + '</div><div class="hist-stat-label">' + declension(history.length, ['тренировка', 'тренировки', 'тренировок']) + '</div></div>' +
        '<div class="hist-stat purple"><div class="hist-stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div><div class="hist-stat-value">' + (totalTonnage / 1000).toFixed(1) + '<span class="hist-stat-unit">т</span></div><div class="hist-stat-label">общий объём</div></div>' +
        '<div class="hist-stat cyan"><div class="hist-stat-icon"><i class="fa-regular fa-stopwatch"></i></div><div class="hist-stat-value">' + Math.round(totalDuration / 60 / history.length) + '<span class="hist-stat-unit">мин</span></div><div class="hist-stat-label">ср. вр. трен.</div></div>' +
        '<div class="hist-stat green"><div class="hist-stat-icon"><i class="fa-solid fa-calendar-days"></i></div><div class="hist-stat-value">' + (perMonthAvg || '—') + '</div><div class="hist-stat-label">трен. в мес.</div></div>' +
        '</div>' : '';
    // Календарь тренировок: месячная сетка с точками в дни с тренировками
    var histCalMonth = window._histCalMonth;
    if (histCalMonth === undefined || histCalMonth === null) { var _t = new Date(); histCalMonth = new Date(_t.getFullYear(), _t.getMonth(), 1).getTime(); }
    var calendarHTML = '';
    if (history.length) {
        var WD_MIN = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
        var byDayMap = {}; // ключ дня -> массив записей тренировки (для перехода в детали по клику)
        history.forEach(function (e) { var d = new Date(e.date); if (!isNaN(d)) { var k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); (byDayMap[k] = byDayMap[k] || []).push(e); } });
        var cur = new Date(histCalMonth);
        var todayRef = new Date(); todayRef.setHours(0, 0, 0, 0);
        var first = new Date(cur.getFullYear(), cur.getMonth(), 1);
        var startOffset = (first.getDay() + 6) % 7; // неделя начинается с понедельника
        var daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
        var monthCount = 0;
        for (var q = 0; q < daysInMonth; q++) { var dd = new Date(cur.getFullYear(), cur.getMonth(), q + 1); if (byDayMap[dd.getFullYear() + '-' + dd.getMonth() + '-' + dd.getDate()]) monthCount++; }
        var cellsHTML = '';
        for (var pre = 0; pre < startOffset; pre++) cellsHTML += '<div class="hist-cal-cell empty"></div>';
        for (var day = 1; day <= daysInMonth; day++) {
            var cd = new Date(cur.getFullYear(), cur.getMonth(), day);
            var dayEntries = byDayMap[cd.getFullYear() + '-' + cd.getMonth() + '-' + cd.getDate()];
            var has = !!(dayEntries && dayEntries.length);
            var isToday = cd.getTime() === todayRef.getTime();
            var isFuture = cd.getTime() > todayRef.getTime();
            var clickable = has && !isFuture;
            var innerHTML = '<span class="hist-cal-day">' + day + '</span>' + (has ? '<span class="hist-cal-dot"></span>' : '');
            // Клик по дню с тренировкой -> подробности тренировки; при нескольких записях — самая свежая
            if (clickable) {
                var targetEntry = dayEntries.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); })[0];
                var calLabel = dayEntries.length === 1 ? 'Открыть тренировку «' + targetEntry.programName + '»' : 'Тренировок в этот день: ' + dayEntries.length + ' — открыть последнюю';
                innerHTML = '<button type="button" class="hist-cal-cell-btn" data-action="history-detail" data-payload="' + escAttr(targetEntry.id) + '" aria-label="' + escAttr(calLabel) + '">' + innerHTML + (dayEntries.length > 1 ? '<span class="hist-cal-count">' + dayEntries.length + '</span>' : '') + '</button>';
            }
            cellsHTML += '<div class="hist-cal-cell' + (has ? ' has' : '') + (isToday ? ' today' : '') + (isFuture ? ' future' : '') + (clickable ? ' clickable' : '') + '">' + innerHTML + '</div>';
        }
        var prevDisabled = false;
        var oldest = history.reduce(function (acc, e) { var t = new Date(e.date).getTime(); return isNaN(t) ? acc : Math.min(acc, t); }, Infinity);
        if (oldest !== Infinity) { var od = new Date(oldest); prevDisabled = (cur.getTime() <= new Date(od.getFullYear(), od.getMonth(), 1).getTime()); }
        var nextDisabled = (new Date(cur.getFullYear(), cur.getMonth() + 1, 1).getTime() > todayRef.getTime());
        calendarHTML = '<div class="hist-cal-card card-enter">' +
            '<div class="hist-cal-head">' +
            '<button type="button" class="hist-cal-nav' + (prevDisabled ? ' off' : '') + '" data-action="hist-cal-prev"' + (prevDisabled ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>' +
            '<div class="hist-cal-title"><i class="fa-regular fa-calendar"></i> ' + formatCalMonthYear(cur) + '</div>' +
            '<button type="button" class="hist-cal-nav' + (nextDisabled ? ' off' : '') + '" data-action="hist-cal-next"' + (nextDisabled ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>' +
            '<div class="hist-cal-weekdays">' + WD_MIN.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
            '<div class="hist-cal-grid">' + cellsHTML + '</div>' +
            '<div class="hist-cal-foot"><span><span class="hist-cal-dot demo"></span> ' + monthCount + ' ' + declension(monthCount, ['тренировка', 'тренировки', 'тренировок']) + ' за месяц</span><a data-action="hist-cal-today">К текущему месяцу</a></div>' +
            '</div>';
    }
    const listHTML = history.length ? history.map(function (entry, idx) { var st = entryStats(entry); var dateStr = relativeDayLabel(entry.date); var mg = muscleGroupColor(entryMainMuscleGroup(entry)); var topGroups = entryTopGroups(entry).slice(0, 3); var groupsLine = topGroups.length ? '<div class="hist-groups-line"><i class="fa-solid fa-dumbbell"></i> ' + escHtml(topGroups.map(function (g) { return g.name + ' ×' + g.count; }).join(' · ')) + '</div>' : ''; return '<div data-action="history-detail" data-payload="' + escAttr(entry.id) + '" class="hist-card app-card mb-3 active:scale-[0.98] transition-transform cursor-pointer card-enter' + (mg ? ' mg-' + mg : '') + '" style="animation-delay: ' + (idx * 0.05) + 's">' +
        '<div class="hist-card-body"><div class="flex justify-between items-start mb-1.5 gap-2"><div class="font-semibold text-base min-w-0 truncate">' + escHtml(entry.programName) + '</div><div class="hist-card-day text-tgHint text-xs whitespace-nowrap pt-0.5">' + escHtml(dateStr) + '</div></div>' +
        groupsLine +
        '<div class="hist-tags"><span class="hist-tag blue"><i class="fa-regular fa-clock"></i> ' + formatDuration(entry.duration) + '</span><span class="hist-tag green"><i class="fa-solid fa-layer-group"></i> ' + st.sets + '</span><span class="hist-tag purple"><i class="fa-solid fa-repeat"></i> ' + st.reps + '</span><span class="hist-tag orange"><i class="fa-solid fa-weight-hanging"></i> ' + (st.tonnage / 1000).toFixed(1) + ' т</span></div></div>' +
        '<i class="fa-solid fa-chevron-right hist-card-arrow"></i></div>'; }).join('') : '<div class="empty-state-block card-enter"><i class="fa-solid fa-clock-rotate-left"></i><div class="title">История пуста</div><div class="desc">Завершите первую тренировку — она появится здесь.</div></div>';
    const header = '<header class="screen-header"><div class="screen-title">История' + (history.length ? '<span class="screen-count">' + history.length + '</span>' : '') + '</div></header>';
    document.getElementById('app-content').innerHTML = header + summaryHTML + calendarHTML + (history.length ? '<div class="section-label">Тренировки</div>' : '') + listHTML +
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
    const renderDetail = function (ex) { const isBw = ex.exerciseType === 'bodyweight'; const mgc = muscleGroupColor(ex.muscleGroup); const groupBadge = ex.muscleGroup ? '<span class="hist-mg-badge' + (mgc ? ' ' + mgc : '') + '">' + escHtml(ex.muscleGroup) + '</span>' : ''; const setsHTML = (ex.sets || []).map(function (s, i) { return '<div class="py-2 border-b border-tgBg last:border-0 flex items-center gap-2.5 ' + (s.setType === 'drop' ? 'text-orange-400' : '') + '"><span class="hist-set-num">' + (i + 1) + '</span><span class="font-medium hist-set-result">' + s.weight + ' кг × ' + s.reps + ' повт</span>' + (s.setType === 'drop' ? '<span class="drop-badge"><i class="fa-solid fa-fire"></i> ДРОП</span>' : '') + '</div>'; }).join(''); const exNote = (typeof ex.note === 'string' && ex.note.trim()) ? ex.note.trim() : ((ex.sets || []).filter(function (s) { return s && s.note; }).map(function (s, i) { return 'Подход ' + (i + 1) + ': ' + s.note; }).join('; ')); const noteBlock = exNote ? '<div class="set-note exercise-note mt-2"><i class="fa-solid fa-comment-dots"></i> ' + escHtml(exNote) + '</div>' : ''; return '<div class="mb-4"><div class="flex items-center gap-2 mb-2 flex-wrap"><h3 class="font-bold text-base">' + escHtml(ex.name) + '</h3>' + groupBadge + (isBw ? '<span class="bodyweight-badge">Собственный вес</span>' : '') + '</div><div class="app-inset p-4 text-sm">' + setsHTML + noteBlock + '</div></div>'; };
    const exHTML = groups.map(function (g) { if (g.type === 'superset') { const style = getSupersetStyle(g.exercises[0].supersetId, allSsIds); return '<div class="app-inset p-3 mb-4" style="' + style.styleAttr + '"><div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold mb-3 uppercase tracking-wide" style="' + style.badgeStyle + '"><i class="fa-solid fa-bolt"></i> СУПЕРСЕТ</div>' + g.exercises.map(renderDetail).join('') + '</div>'; } return renderDetail(g.exercise); }).join('');
    var dst = entryStats(entry);
    var dcolor = programColor(entry.programName);
    var topGroupsD = entryTopGroups(entry).slice(0, 4);
    var groupsChipsHTML = topGroupsD.length ? '<div class="hist-detail-groups">' + topGroupsD.map(function (g) { var gc = muscleGroupColor(g.name); return '<span class="hist-mg-badge' + (gc ? ' ' + gc : '') + '">' + escHtml(g.name) + ' <b>×' + g.count + '</b></span>'; }).join('') + '</div>' : '';
    // Если в тот же день есть другие тренировки — кнопки < > для переключения между ними
    var daySiblings = DataAPI.getHistory().filter(function (e) { var a = new Date(e.date), b = new Date(entry.date); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var pos = daySiblings.findIndex(function (e) { return e.id === entry.id; });
    var navCounter = daySiblings.length > 1 ? '<span class="hist-detail-nav"><button type="button" class="hist-detail-nav-btn' + (pos <= 0 ? ' off' : '') + '" data-action="history-detail-prev"' + (pos <= 0 ? ' disabled' : '') + ' aria-label="Предыдущая тренировка в этот день"><i class="fa-solid fa-chevron-left"></i></button><span class="hist-detail-nav-count">' + (pos + 1) + '/' + daySiblings.length + '</span><button type="button" class="hist-detail-nav-btn' + (pos >= daySiblings.length - 1 ? ' off' : '') + '" data-action="history-detail-next"' + (pos >= daySiblings.length - 1 ? ' disabled' : '') + ' aria-label="Следующая тренировка в этот день"><i class="fa-solid fa-chevron-right"></i></button></span>' : '';
    var headHTML = '<div class="screen-header hist-detail-head ' + dcolor + '">' +
        '<div class="flex items-start justify-between gap-2"><h2 class="hist-detail-title min-w-0">' + escHtml(entry.programName) + '</h2>' + navCounter + '</div>' +
        '<p class="hist-detail-date"><i class="fa-regular fa-calendar mr-1"></i>' + date + '</p>' +
        groupsChipsHTML +
        '<div class="hist-detail-stats">' +
        '<div class="hist-detail-stat"><div class="t blue"><i class="fa-regular fa-clock"></i></div><div class="v blue">' + formatDuration(entry.duration) + '</div><div class="l">длительность тренировки</div></div>' +
        '<div class="hist-detail-stat"><div class="t green"><i class="fa-solid fa-layer-group"></i></div><div class="v green">' + dst.sets + '</div><div class="l">всего подходов</div></div>' +
        '<div class="hist-detail-stat"><div class="t purple"><i class="fa-solid fa-repeat"></i></div><div class="v purple">' + dst.reps + '</div><div class="l">всего повторений</div></div>' +
        '<div class="hist-detail-stat"><div class="t orange"><i class="fa-solid fa-weight-hanging"></i></div><div class="v orange">' + (dst.tonnage / 1000).toFixed(1) + ' т</div><div class="l">суммарный тоннаж</div></div>' +
        '</div>' +
        '<button type="button" class="hist-detail-delete" data-action="history-delete-entry" data-payload="' + escAttr(entry.id) + '" aria-label="Удалить тренировку из истории"><i class="fa-regular fa-trash-can"></i> Удалить тренировку</button>' +
        '</div>';
    document.getElementById('app-content').innerHTML = headHTML + exHTML;
    window._histDetailEntryId = entry.id;
    // При открытии/переключении тренировки всегда прокручиваем экран к началу
    window.scrollTo(0, 0);
    var _sc = document.getElementById('app-content'); if (_sc) _sc.scrollTop = 0;
}

// Удаление тренировки из истории (с подтверждением)
function deleteHistoryEntry(entryId) {
    var entry = DataAPI.getHistoryEntryById(entryId);
    if (!entry) return;
    showConfirm('Удалить тренировку «' + entry.programName + '» из истории?', function (ok) {
        if (!ok) return;
        DataAPI.saveHistory(DataAPI.getHistory().filter(function (e) { return e.id !== entryId; }));
        haptic('warning');
        window._histDetailEntryId = null;
        navigate('history');
    });
}

// Переключение между тренировками одного дня (dir = -1 новее / +1 старее)
function histDetailSibling(dir) {
    var cur = DataAPI.getHistoryEntryById(window._histDetailEntryId);
    if (!cur) return;
    var a0 = new Date(cur.date);
    var daySiblings = DataAPI.getHistory().filter(function (e) { var a = new Date(e.date); return a.getFullYear() === a0.getFullYear() && a.getMonth() === a0.getMonth() && a.getDate() === a0.getDate(); }).sort(function (x, y) { return new Date(y.date) - new Date(x.date); });
    var pos = daySiblings.findIndex(function (e) { return e.id === cur.id; });
    var next = daySiblings[pos + dir];
    if (!next) return;
    haptic('light');
    navigate('history_detail', { entryId: next.id });
}
