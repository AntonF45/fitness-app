/* Измеряет реальную высоту sticky-шапки экрана и записывает её в CSS-переменную
   --header-h на #app-content. Используется правилом из styles.css:
     #app-content > :not(.screen-header):not(.stats-header) { margin-top: var(--header-h); }
   чтобы контент страницы начинался ПОСЛЕ прилипшей шапки, а не под ней.
   ResizeObserver реагирует на смену контента (разные экраны, перенос строк,
   поворот экрана), поэтому отступ всегда равен актуальной высоте шапки. */
(function () {
    'use strict';

    function applyHeaderHeight() {
        var container = document.getElementById('app-content');
        if (!container) return;
        var header = container.querySelector(':scope > .screen-header, :scope > .stats-header');
        var h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
        container.style.setProperty('--header-h', h + 'px');
    }

    function init() {
        var container = document.getElementById('app-content');
        if (!container) return;

        applyHeaderHeight();

        if (typeof ResizeObserver !== 'undefined') {
            // Наблюдаем за самим контейнером: при любой перерисовке экрана
            // (renderXxx меняет innerHTML) колбэк вызывается повторно.
            var ro = new ResizeObserver(applyHeaderHeight);
            ro.observe(container);
        } else {
            // Фолбэк для старых WebView: пересчёт после каждой перерисовки.
            ['render', 'DOMContentLoaded', 'resize'].forEach(function (evt) {
                window.addEventListener(evt, applyHeaderHeight);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
