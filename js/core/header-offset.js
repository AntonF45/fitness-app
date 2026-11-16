/* core/header-offset.js — измерение высоты sticky-шапки экрана.

   Нужен ровно для одного случая: редактор программы, где под шапкой липнет
   ВТОРОЙ sticky-слой (баннер суперсета .sticky.top-2). Его граница прилипания
   в CSS считается как var(--top-reserve) + var(--header-h), поэтому высоту
   реальной шапки (--header-h) измеряем здесь и обновляем при смене контента,
   переносе строк заголовка и повороте экрана.

   Все остальные экраны работают на чистом CSS: body имеет padding-top
   --top-reserve (полоса Telegram), а sticky-шапки липнут к top: --top-reserve —
   то есть фиксируются ровно под системными кнопками «Закрыть/назад». */
'use strict';

function applyHeaderHeight() {
    var container = document.getElementById('app-content');
    if (!container) return;

    var header = container.querySelector(
        ':scope > .screen-header, :scope > .stats-header'
    );

    if (!header) {
        container.classList.remove('has-sticky-header');
        container.style.removeProperty('--header-h');
        return;
    }

    container.classList.add('has-sticky-header');

    // getBoundingClientRect().height включает padding+border — то, что реально
    // перекрывает контент. Для content-box border добавляем явно.
    // +1px — запас на hairline-границу шапки.
    var h = Math.ceil(header.getBoundingClientRect().height);
    var cs = getComputedStyle(header);
    if (cs.boxSizing === 'content-box') {
        h += Math.ceil(parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth));
    }
    container.style.setProperty('--header-h', (h + 1) + 'px');
}

(function init() {
    var container = document.getElementById('app-content');
    if (!container) return;

    applyHeaderHeight();

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(applyHeaderHeight).observe(container);
    } else {
        ['render', 'DOMContentLoaded', 'resize'].forEach(function (evt) {
            window.addEventListener(evt, applyHeaderHeight);
        });
    }

    // Пересчёт по кадру сразу после перерисовки экрана (innerHTML меняет
    // childList — getBoundingClientRect тогда даёт актуальную высоту).
    var rafPending = false;
    function scheduleRecalc() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(function () { rafPending = false; applyHeaderHeight(); });
    }
    new MutationObserver(scheduleRecalc).observe(container, { childList: true });
    window.addEventListener('resize', scheduleRecalc);
})();
