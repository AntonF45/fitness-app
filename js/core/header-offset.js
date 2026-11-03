/* Единая модель sticky-шапок по образцу блока «Секундомер» (экран тренировки):
   контент физически начинается ПОСЛЕ строки резервации, а sticky-панель
   прилипает к верху окна и заполняет эту строку при прокрутке.

   Реализация: если первый дочерний элемент #app-content — sticky-шапка
   (.screen-header / .stats-header), контейнер получает класс has-sticky-header.
   CSS (#app-content.has-sticky-header) ставит padding-top = полоса Telegram
   (--top-reserve) + var(--header-h), где --header-h — РЕАЛЬНАЯ высота шапки,
   которую измеряет этот скрипт (ResizeObserver + MutationObserver реагируют
   на смену экрана, перенос строк и поворот).

   На экранах без sticky-шапки (тренировка, детали программы) класс снимается:
   там работает общий body padding-top: var(--top-reserve) — ровно как у
   секундомера всегда. */
(function () {
    'use strict';

    function applyHeaderHeight() {
        var container = document.getElementById('app-content');
        if (!container) return;

        // Шапка — ЛЮБОЙ sticky-заголовок экрана: обычный, статистика,
        // детали записи истории или верхняя панель секундомера тренировки.
        var header = container.querySelector(
            ':scope > .screen-header, :scope > .stats-header, :scope > .sticky.top-0'
        );

        if (!header) {
            container.classList.remove('has-sticky-header');
            container.style.removeProperty('--header-h');
            return;
        }

        container.classList.add('has-sticky-header');

        // getBoundingClientRect().height включает padding+border (то, что
        // реально перекрывает контент при скролле). Для блоков content-box
        // border добавляем явно. +1px запас на hairline-границу шапки.
        var h = Math.ceil(header.getBoundingClientRect().height);
        var cs = getComputedStyle(header);
        if (cs.boxSizing === 'content-box') {
            h += Math.ceil(parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth));
        }
        container.style.setProperty('--header-h', (h + 1) + 'px');
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
        // Пересчёт по кадрам сразу после смены контента (getBoundingClientRect
        // форсирует layout и даёт актуальную высоту новой шапки).
        var rafPending = false;
        function scheduleRecalc() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(function () { rafPending = false; applyHeaderHeight(); });
        }
        new MutationObserver(scheduleRecalc).observe(container, { childList: true });
        window.addEventListener('resize', scheduleRecalc);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
