/* features/stats/stats.chart.js — визуализация: плагин «перекрестие» и график прогресса
   упражнения на Chart.js. Отделено от контроллера экрана. */
'use strict';

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: function (chart) {
        if (chart._active && chart._active.length) {
            const p = chart._active[0]; const ctx = chart.ctx; const x = p.element.x;
            ctx.save(); ctx.beginPath(); ctx.moveTo(x, chart.scales.y.top); ctx.lineTo(x, chart.scales.y.bottom); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.beginPath(); ctx.arc(x, p.element.y, 6, 0, 2 * Math.PI); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.beginPath(); ctx.arc(x, p.element.y, 4, 0, 2 * Math.PI); ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-link-color') || '#3b82f6'; ctx.fill(); ctx.restore();
        }
    }
};
function renderChart() {
    const canvas = document.getElementById('progressChart'); if (!canvas) return;
    const old = Chart.getChart(canvas); if (old) old.destroy();
    if (!state.selectedExercise) return;
    const filtered = getFilteredHistory(DataAPI.getExerciseHistory(state.selectedExercise).filter(isValidSetRecord), state.selectedPeriod);
    if (filtered.length === 0) return;
    const byDay = {};
    filtered.forEach(function (item) { const key = formatLocalDateKey(item.date); if (!key) return; if (!byDay[key]) byDay[key] = { date: new Date(item.date), weight: 0, volume: 0, max1RM: 0 }; const w = Number(item.weight), r = Number(item.reps); if (w > byDay[key].weight) byDay[key].weight = w; byDay[key].volume += w * r; const est = estimate1RM(w, r); if (est > byDay[key].max1RM) byDay[key].max1RM = est; });
    const sortedKeys = Object.keys(byDay).sort();
    const labels = sortedKeys.map(function (k) { return String(byDay[k].date.getDate()); });
    const dates = sortedKeys.map(function (k) { return byDay[k].date; });
    const metric = state.selectedExerciseMetric || 'weight';
    let data, unit = 'кг';
    if (metric === 'volume') data = sortedKeys.map(function (k) { return byDay[k].volume; });
    else if (metric === '1rm') data = sortedKeys.map(function (k) { return Math.round(byDay[k].max1RM); });
    else data = sortedKeys.map(function (k) { return byDay[k].weight; });
    const linkColor = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-link-color') || '#3b82f6';
    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, linkColor + '30'); gradient.addColorStop(1, linkColor + '00');
    const spanDays = dates.length > 1 ? (dates[dates.length - 1] - dates[0]) / 86400000 : 0;
    try {
        new Chart(canvas, {
            type: 'line',
            data: { labels: labels, datasets: [{ data: data, borderColor: linkColor, backgroundColor: gradient, borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: '#ffffff', pointHoverBorderColor: linkColor, pointHoverBorderWidth: 3 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(30,30,32,0.95)', titleColor: '#8e8e93', bodyColor: '#ffffff', bodyFont: { size: 14, weight: 'bold' }, padding: 10, cornerRadius: 10, displayColors: false, callbacks: { title: function (items) { const d = dates[items[0].dataIndex]; return d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear() + ', ' + WEEKDAYS_RU[d.getDay()]; }, label: function (item) { return item.raw + ' ' + unit; } } } },
                scales: { y: { display: false, beginAtZero: metric !== 'weight', grace: '10%' }, x: { grid: { display: false }, ticks: { color: '#8e8e93', font: { size: 10 }, padding: 6, maxRotation: 0, autoSkip: true, maxTicksLimit: 7, callback: function (v, i) { const d = dates[i]; if (!d) return ''; return spanDays > 60 ? d.getDate() + ' ' + MONTHS_RU[d.getMonth()] : d.getDate() + ' ' + WEEKDAYS_RU[d.getDay()]; } }, border: { display: false } } },
                animation: { duration: 400, easing: 'easeOutQuart' }
            },
            plugins: [crosshairPlugin]
        });
    } catch (err) { console.error('Chart render failed', err); }
}
