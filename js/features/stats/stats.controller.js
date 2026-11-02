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
    /* Список месяцев строим от ВСЕЙ истории, а не от выбранного упражнения: иначе при выборе
       упражнения без тренировок в выбранном месяце кнопка месяца исчезала и фильтр сбрасывался. */
    const monthsHTML = getAvailableMonthsForHistory().map(function (m) { return '<button data-action="select-month" data-payload="' + escAttr(m.key) + '" class="period-btn ' + (state.selectedMonthKey === m.key ? 'active' : '') + '">' + escHtml(m.label) + '</button>'; }).join('');

    const periodsHTML =
        '<button data-action="select-period" data-payload="week" class="period-btn ' + (state.selectedPeriod === 'week' && !state.selectedMonthKey ? 'active' : '') + '">7 дней</button>' +
        '<button data-action="select-period" data-payload="month" class="period-btn ' + (state.selectedPeriod === 'month' && !state.selectedMonthKey ? 'active' : '') + '">30 дней</button>' +
        '<button data-action="select-period" data-payload="quarter" class="period-btn ' + (state.selectedPeriod === 'quarter' && !state.selectedMonthKey ? 'active' : '') + '">90 дней</button>' +
        '<button data-action="select-period" data-payload="all" class="period-btn ' + (state.selectedPeriod === 'all' && !state.selectedMonthKey ? 'active' : '') + '">Всё</button>';

    document.getElementById('app-content').innerHTML =
        '<div class="stats-header bg-tgBg/95 backdrop-blur-md card-enter">' +
            '<h1 id="stats-title" class="stats-title">Статистика: ' + escHtml(getPeriodLabel()) + '</h1>' +
            /* Одна строка: [месяцы] [периоды — выезжают справа налево поверх месяцев] [фильтр/крестик].
               Периоды абсолютно позиционированы у правого края и скрыты translateX(100%);
               при открытии панель «7 дн / 30 дн / …» выезжает из-под кнопки фильтра влево,
               смещая месяцы за экран; кнопка фильтра превращается в крестик (crossfade иконок). */
            '<div class="filter-line' + (state.filterOpen ? ' open' : '') + '">' +
                '<div id="months-scroll" class="months-track">' + monthsHTML + '</div>' +
                '<div class="period-filter periods-panel">' + periodsHTML + '</div>' +
                '<button id="filter-toggle-btn" data-action="toggle-filter" class="filter-toggle-btn" aria-label="Фильтр периода" aria-expanded="' + (state.filterOpen ? 'true' : 'false') + '">' +
                    '<i class="fa-solid fa-sliders fi-sliders"></i><i class="fa-solid fa-xmark fi-xmark"></i>' +
                '</button>' +
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
/* Переключение панели периодов — только CSS-класс на строке фильтра:
   панель выезжает справа налево, месяцы уходят за экран, кнопка становится крестиком.
   Состояние запоминается в state.filterOpen, чтобы панель не «хлопала» при перерисовке экрана. */
function toggleFilterPanel() {
    const line = document.querySelector('.filter-line');
    if (!line) return;
    state.filterOpen = !state.filterOpen;
    line.classList.toggle('open', state.filterOpen);
    const btn = document.getElementById('filter-toggle-btn');
    if (btn) btn.setAttribute('aria-expanded', String(state.filterOpen));
    haptic('light');
}
function selectMonthFilter(monthKey) { state.selectedMonthKey = state.selectedMonthKey === monthKey ? null : monthKey; if (state.selectedMonthKey) state.selectedPeriod = 'month'; haptic('light'); renderStats(); }
function selectPeriod(period) { state.selectedPeriod = period; state.selectedMonthKey = null; state.filterOpen = false; haptic('light'); renderStats(); }
/* Выбор группы/упражнения НЕ сбрасывает фильтр периода (месяц, напр. «сентябрь»):
   раньше здесь обнулялся selectedMonthKey и активным оставался период «30 дней». */
function selectMuscleGroup(group) { state.selectedMuscleGroup = group; state.selectedExercise = null; haptic('light'); renderStats(); }
function selectExercise(name) { state.selectedExercise = state.selectedExercise === name ? null : name; state.selectedExerciseMetric = 'weight'; haptic('light'); renderStats(); }
function selectExerciseMetric(metric) { if (['weight','volume','1rm'].indexOf(metric) === -1) return; state.selectedExerciseMetric = metric; haptic('light'); renderStats(); }
