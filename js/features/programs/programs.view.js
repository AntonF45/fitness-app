/* features/programs/programs.view.js — экран списка программ: карточки, суперсет-блоки, CTA. */
'use strict';

function renderPrograms() {
    const programs = DataAPI.getPrograms();
    let listHTML = programs.length ? programs.map(function (program, index) {
        const exercises = program.exercises || []; const allSsIds = exercises.map(function (e) { return e.supersetId; });
        const blocks = []; const processed = new Set(); let counter = 1;
        exercises.forEach(function (exercise, idx) {
            if (processed.has(idx)) return;
            if (exercise.supersetId) {
                const group = exercises.map(function (e, i) { e = Object.assign({}, e); e.originalIndex = i; return e; }).filter(function (e) { return e.supersetId === exercise.supersetId; });
                group.forEach(function (e) { processed.add(e.originalIndex); });
                const style = getSupersetStyle(exercise.supersetId, allSsIds);
                blocks.push('<div class="app-inset p-2.5 mb-2" style="' + style.styleAttr + '"><div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold mb-2 uppercase tracking-wide" style="' + style.badgeStyle + '"><i class="fa-solid fa-bolt"></i> Суперсет</div><div class="divide-y divide-tgSecondaryBg/40">' + group.map(function (e) { return '<div class="flex items-start gap-2 py-1.5"><span class="text-tgHint font-mono text-xs shrink-0 mt-0.5">' + (counter++) + '.</span><div class="flex-1 min-w-0"><div class="text-sm font-medium leading-snug break-words">' + escHtml(e.name) + '</div></div><span class="font-mono text-xs text-tgHint shrink-0 app-inset px-2 py-0.5 whitespace-nowrap">' + (e.targetSets ?? 3) + ' × ' + (e.targetReps ?? 10) + '</span></div>'; }).join('') + '</div></div>');
            } else {
                processed.add(idx);
                blocks.push('<div class="flex items-start gap-2 py-1.5 border-b border-tgSecondaryBg/40 last:border-0"><span class="text-tgHint font-mono text-xs shrink-0 mt-0.5">' + (counter++) + '.</span><div class="flex-1 min-w-0"><div class="text-sm font-medium leading-snug break-words">' + escHtml(exercise.name) + '</div></div><span class="font-mono text-xs text-tgHint shrink-0 app-inset px-2 py-0.5 whitespace-nowrap">' + (exercise.targetSets ?? 3) + ' × ' + (exercise.targetReps ?? 10) + '</span></div>');
            }
        });
        return '<div class="app-card mb-3 card-enter" style="animation-delay: ' + (index * 0.05) + 's"><div class="flex items-start justify-between gap-3 mb-3"><div class="font-semibold text-base break-words flex-1 min-w-0 pt-1">' + escHtml(program.name) + '</div><div class="flex items-center gap-1.5 shrink-0"><button data-action="edit-program" data-payload="' + escAttr(program.id) + '" class="btn-icon" aria-label="Редактировать"><i class="fa-solid fa-pen text-sm"></i></button><button data-action="delete-program" data-payload="' + escAttr(program.id) + '" class="btn-icon danger" aria-label="Удалить"><i class="fa-solid fa-trash text-sm"></i></button></div></div><div class="space-y-0.5 mb-4">' + (blocks.join('') || '<div class="text-tgHint text-xs italic py-1">Нет упражнений</div>') + '</div><button data-action="start-workout" data-payload="' + escAttr(program.id) + '" class="btn btn-primary"><i class="fa-solid fa-play text-sm"></i> Начать тренировку</button></div>';
    }).join('') : '<div class="empty-state-block card-enter"><i class="fa-solid fa-list-check"></i><div class="title">Нет созданных программ</div><div class="desc">Создайте первую программу, чтобы начать тренироваться.</div></div>';
    const label = programs.length ? '<div class="section-label">Программы · ' + programs.length + '</div>' : '';
    document.getElementById('app-content').innerHTML = label + listHTML +
        '<div style="height: 110px"></div>' +
        '<div class="sticky-bottom-action"><button data-action="create-program" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Создать программу</button></div>';

}
