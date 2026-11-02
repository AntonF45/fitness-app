/* features/stats/stats.view.js — чистые функции генерации HTML блоков статистики.
   Только представление: читают state/DataAPI, возвращают строку, ничего не сохраняют. */
'use strict';

function renderGeneralSummaryHTML(filteredHistory) {
    const validEntries = (filteredHistory || []).filter(function (e) { return (e.exercises || []).some(function (ex) { return (ex.sets || []).some(isValidSetRecord); }); });
    let workingSets = 0, totalVolume = 0;
    validEntries.forEach(function (entry) { (entry.exercises || []).forEach(function (ex) { (ex.sets || []).forEach(function (s) { if (isValidSetRecord(s)) { workingSets++; totalVolume += Number(s.weight) * Number(s.reps); } }); }); });
    const periodLabel = getPeriodLabel();
    if (validEntries.length === 0) return '<div class="empty-state-block mb-3 card-enter"><i class="fa-solid fa-calendar-xmark"></i><div class="title">Нет тренировок за ' + escHtml(periodLabel) + '</div><div class="desc">Завершите тренировку — и здесь появится сводка.</div></div>';
    const cells = [
        { icon: '📅', color: 'blue',   value: validEntries.length, label: 'тренировок', sub: 'за период' },
        { icon: '▤',  color: 'purple', value: workingSets,         label: 'подходов',   sub: 'всего за период' },
        { icon: '⚖',  color: 'green',  value: (totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) + ' т' : totalVolume + ' кг'), label: 'объём', sub: 'суммарный тоннаж' }
    ];
    return '<div class="mb-3 card-enter"><div class="section-label">Сводка · ' + escHtml(periodLabel) + '</div><div class="summary-grid">' + cells.map(function (c) {
        return '<div class="summary-cell stat-metric ' + c.color + '"><div class="t"><span class="ti">' + c.icon + '</span></div><div class="v">' + c.value + '</div><div class="l">' + escHtml(c.label) + ' · ' + escHtml(c.sub) + '</div></div>';
    }).join('') + '</div></div>';
}
function renderMuscleGroupSetsChartHTML(filteredHistory) {
    const mgSets = {};
    filteredHistory.forEach(function (entry) { (entry.exercises || []).forEach(function (ex) { const mg = ex.muscleGroup || 'Другое'; if (!mgSets[mg]) mgSets[mg] = 0; (ex.sets || []).forEach(function (s) { if (isValidSetRecord(s)) mgSets[mg]++; }); }); });
    const labels = Object.keys(mgSets);
    if (labels.length === 0) return '';
    const canvasId = 'mgSetsChart';
    setTimeout(function () {
        const ctx = document.getElementById(canvasId); if (!ctx) return;
        const old = Chart.getChart(ctx); if (old) old.destroy();
        try {
            new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Подходы', data: labels.map(function (l) { return mgSets[l]; }), backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgba(59, 130, 246, 0.8)', borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(142, 142, 147, 0.1)' } }, x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { display: false } } } } });
        } catch (err) { console.error('Chart init failed', err); }
    }, 100);
    return '<div class="chart-card rounded-2xl p-4 mb-3 card-enter"><div class="section-label">Подходы по группам мышц</div><div class="chart-container-fixed" style="height: 200px;"><div class="chart-wrapper-fixed"><canvas id="' + canvasId + '"></canvas></div></div></div>';
}
function renderExerciseMetricSwitcherHTML() {
    const metrics = [{ key: 'weight', label: 'Вес' }, { key: 'volume', label: 'Тоннаж' }, { key: '1rm', label: '1ПМ*' }];
    return '<div class="metric-switcher" role="tablist" aria-label="Метрика графика">' + metrics.map(function (m) { return '<button data-action="select-metric" data-payload="' + m.key + '" role="tab" aria-selected="' + (state.selectedExerciseMetric === m.key) + '" class="metric-btn ' + (state.selectedExerciseMetric === m.key ? 'active' : '') + '">' + escHtml(m.label) + '</button>'; }).join('') + '</div>' + (state.selectedExerciseMetric === '1rm' ? '<div class="metric-note">* Расчётный 1ПМ по формулам Epley/Brzycki.</div>' : '');
}
function renderAchievementsHTML() {
    const name = state.selectedExercise; if (!name) return '';
    const history = DataAPI.getExerciseHistory(name).filter(isValidSetRecord);
    const exType = getExerciseTypeByName(name);
    if (history.length === 0) return '<div class="empty-state-block mb-4 card-enter"><i class="fa-solid fa-trophy"></i><div class="title">Нет рабочих подходов</div><div class="desc">Для этого упражнения пока нет завершённых подходов с весом и повторениями.</div></div>';
    const maxWeight = Math.max.apply(null, history.map(function (h) { return Number(h.weight); }));
    const maxWeightEntry = history.find(function (h) { return Number(h.weight) === maxWeight; });
    let max1RM = 0, max1RMEntry = null;
    history.forEach(function (h) { const est = estimate1RM(h.weight, h.reps); if (est > max1RM) { max1RM = est; max1RMEntry = h; } });
    // Лучшая серия тренировок подряд (по календарным дням, без пропусков)
    const dayKeys = Array.from(new Set(history.map(function (h) { return formatLocalDateKey(h.date); }).filter(Boolean))).sort();
    let bestStreak = 0, run = 0, prevKey = null;
    dayKeys.forEach(function (k) {
        if (prevKey) {
            const p = new Date(prevKey + 'T00:00:00'), c = new Date(k + 'T00:00:00');
            const diffDays = Math.round((c - p) / 86400000);
            run = diffDays === 1 ? run + 1 : 1;
        } else { run = 1; }
        if (run > bestStreak) bestStreak = run;
        prevKey = k;
    });
    const totalVolume = history.reduce(function (s, h) { return s + Number(h.weight) * Number(h.reps); }, 0);
    const fmtDate = function (entry) { if (!entry) return ''; const d = new Date(entry.date); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
    const achievements = [
        { tIcon: '⚖',  color: 'gold',   v: maxWeight + ' кг', l: 'макс. вес · ' + fmtDate(maxWeightEntry) },
        { tIcon: '🏋', color: 'blue',   v: Math.round(max1RM) + ' кг', l: 'расчётный 1ПМ · ' + fmtDate(max1RMEntry) },
        { tIcon: '🔥', color: 'green',  v: bestStreak || '—', l: 'лучшая серия дней подряд' },
        { tIcon: '∑',  color: 'purple', v: totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) + ' т' : totalVolume + ' кг', l: exType === 'bodyweight' ? 'объём доп. веса · всего' : 'общий объём · всего' }
    ];
    return '<div class="mb-4 card-enter"><div class="section-label">Рекорды · за всё время</div><div class="summary-grid" style="grid-template-columns: repeat(2, 1fr);">' + achievements.map(function (a) { return '<div class="summary-cell stat-metric ' + a.color + '"><div class="t"><span class="ti">' + a.tIcon + '</span></div><div class="v">' + escHtml(String(a.v)) + '</div><div class="l">' + escHtml(a.l) + '</div></div>'; }).join('') + '</div></div>';
}
function renderExerciseBlockHTML() {
    if (!state.selectedExercise) return '';
    const exHistory = DataAPI.getExerciseHistory(state.selectedExercise);
    const filtered = getFilteredHistory(exHistory, state.selectedPeriod);
    const exType = getExerciseTypeByName(state.selectedExercise);
    if (!filtered.some(isValidSetRecord)) return '<div class="chart-card rounded-2xl p-4 mb-3 card-enter"><div class="flex items-center justify-between mb-3"><h2 class="text-base font-bold break-words flex-1 min-w-0 pr-2">' + escHtml(state.selectedExercise) + '</h2></div><div class="empty-state-block"><i class="fa-solid fa-chart-line"></i><div class="title">Нет данных за период</div><div class="desc">Для этого упражнения нет рабочих подходов в выбранном периоде.</div></div></div>';
    return '<div class="chart-card rounded-2xl p-4 mb-3 card-enter"><div class="flex items-center justify-between mb-2 gap-2"><h2 class="text-base font-bold break-words flex-1 min-w-0">' + escHtml(state.selectedExercise) + '</h2>' + (exType === 'bodyweight' ? '<span class="bodyweight-badge shrink-0">Свой вес</span>' : '') + '</div>' + renderExerciseMetricSwitcherHTML() + '<div class="chart-container-fixed"><div class="chart-wrapper-fixed"><canvas id="progressChart" aria-label="График прогресса упражнения"></canvas></div></div>' + (exType === 'bodyweight' ? '<div class="metric-note">Вес = только дополнительный вес, без массы тела.</div>' : '') + '</div>' + renderAchievementsHTML();
}
