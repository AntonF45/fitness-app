/* features/stats/stats.controller.js — контроллер экрана «Статистика»: собирает данные,
   рендерит view, обрабатывает выбор группы/упражнения/периода/метрики. */
'use strict';

function renderStats() {
    const history = DataAPI.getHistory();
    const filteredHistory = getFilteredHistory(history, state.selectedPeriod);
    const exercises = DataAPI.getUserExercises();
    const muscleGroups = getMuscleGroups();
    const muscleGroupsHTML = muscleGroups.map(function (g) { return '<button data-action="select-muscle-group" data-payload="' + escAttr(g) + '" role="tab" aria-selected="' + (state.selectedMuscleGroup === g) + '" class="stat-chip snap-center px-3 py-2 rounded-xl text-xs font-medium ' + (state.selectedMuscleGroup === g ? 'active' : 'inactive') + '">' + escHtml(g) + '</button>'; }).join('');
    const filteredExercises = exercises.filter(function (ex) { return ex.muscleGroup === state.selectedMuscleGroup; });
    const exercisesHTML = filteredExercises.length ? filteredExercises.map(function (ex) { return '<button data-action="select-exercise" data-payload="' + escAttr(ex.name) + '" role="tab" aria-selected="' + (state.selectedExercise === ex.name) + '" class="stat-chip snap-center px-3 py-2 rounded-xl text-xs font-medium ' + (state.selectedExercise === ex.name ? 'active' : 'inactive') + '">' + escHtml(ex.name) + '</button>'; }).join('') : '<div class="empty-state-block"><i class="fa-solid fa-dumbbell"></i><div class="title">Нет упражнений</div><div class="desc">В группе «' + escHtml(state.selectedMuscleGroup) + '» пока нет упражнений.</div></div>';
    const monthsHTML = getAvailableMonthsForExercise(state.selectedExercise).map(function (m) { return '<button data-action="select-month" data-payload="' + escAttr(m.key) + '" class="period-btn ' + (state.selectedMonthKey === m.key ? 'active' : '') + '">' + escHtml(m.label) + '</button>'; }).join('');

    document.getElementById('app-content').innerHTML =
        '<div class="stats-header bg-tgBg/95 backdrop-blur-md card-enter">' +
            '<h1 id="stats-title" class="stats-title">Статистика: ' + escHtml(getPeriodLabel()) + '</h1>' +
            '<div class="flex items-center gap-2 mt-3">' +
                '<div id="months-scroll" class="flex-1 overflow-x-auto scroll-container flex gap-1.5">' + monthsHTML + '</div>' +
                '<button id="filter-toggle-btn" data-action="toggle-filter" class="filter-toggle-btn shrink-0" aria-label="Фильтр периода"><i class="fa-solid fa-sliders"></i></button>' +
            '</div>' +
            '<div id="chart-top-bar" class="chart-top-bar">' +
                '<div id="chart-top-slider" class="chart-top-slider">' +
                    '<div class="flex items-center justify-end gap-2 pr-1"><button data-action="toggle-filter" class="filter-toggle-btn" aria-label="Закрыть фильтр"><i class="fa-solid fa-xmark"></i></button></div>' +
                    '<div class="flex items-center pl-1"><div class="period-filter flex-1">' +
                        '<button data-action="select-period" data-payload="week" class="period-btn ' + (state.selectedPeriod === 'week' && !state.selectedMonthKey ? 'active' : '') + '">7 дней</button>' +
                        '<button data-action="select-period" data-payload="month" class="period-btn ' + (state.selectedPeriod === 'month' && !state.selectedMonthKey ? 'active' : '') + '">30 дней</button>' +
                        '<button data-action="select-period" data-payload="quarter" class="period-btn ' + (state.selectedPeriod === 'quarter' && !state.selectedMonthKey ? 'active' : '') + '">90 дней</button>' +
                        '<button data-action="select-period" data-payload="all" class="period-btn ' + (state.selectedPeriod === 'all' && !state.selectedMonthKey ? 'active' : '') + '">Всё</button>' +
                    '</div><button data-action="toggle-filter" class="filter-toggle-btn ml-2" aria-label="Закрыть фильтр"><i class="fa-solid fa-xmark"></i></button></div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="pt-4">' +
            '<div id="stats-summary-container">' + renderGeneralSummaryHTML(filteredHistory) + '</div>' +
            renderMuscleGroupSetsChartHTML(filteredHistory) +
            '<div class="mb-3 card-enter"><div class="section-label">Группа мышц</div><div id="muscle-groups-container" class="flex overflow-x-auto gap-2 pb-1 snap-x scroll-container">' + muscleGroupsHTML + '</div></div>' +
            '<div class="mb-4 card-enter"><div class="section-label">Упражнения</div><div id="exercises-container" class="flex overflow-x-auto gap-2 pb-1 snap-x scroll-container">' + exercisesHTML + '</div></div>' +
            '<div id="exercise-block-container">' + renderExerciseBlockHTML() + '</div>' +
        '</div>';

    setTimeout(function () {
        document.querySelectorAll('.scroll-container').forEach(function (c) { const a = c.querySelector('[aria-selected="true"]'); if (a) a.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' }); });
    }, 50);
    if (state.selectedExercise) renderChart();
}
function toggleFilterPanel() { const slider = document.getElementById('chart-top-slider'); const bar = document.getElementById('chart-top-bar'); const btn = document.getElementById('filter-toggle-btn'); if (!slider || !bar) return; slider.classList.toggle('show-filter'); bar.classList.toggle('expanded'); if (btn) btn.classList.toggle('active'); haptic('light'); }
function selectMonthFilter(monthKey) { state.selectedMonthKey = state.selectedMonthKey === monthKey ? null : monthKey; if (state.selectedMonthKey) state.selectedPeriod = 'month'; haptic('light'); renderStats(); }
function selectPeriod(period) { state.selectedPeriod = period; state.selectedMonthKey = null; haptic('light'); renderStats(); }
function selectMuscleGroup(group) { state.selectedMuscleGroup = group; state.selectedExercise = null; state.selectedMonthKey = null; haptic('light'); renderStats(); }
function selectExercise(name) { state.selectedExercise = state.selectedExercise === name ? null : name; state.selectedMonthKey = null; state.selectedExerciseMetric = 'weight'; haptic('light'); renderStats(); }
function selectExerciseMetric(metric) { if (['weight','volume','1rm'].indexOf(metric) === -1) return; state.selectedExerciseMetric = metric; haptic('light'); renderStats(); }
