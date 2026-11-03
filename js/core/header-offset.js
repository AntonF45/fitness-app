/* Измеряет реальную высоту sticky-шапки экрана и записывает её в CSS-переменную
   --header-h на #app-content. Используется правилом из styles.css:
     .screen-header + *, .stats-header + * { margin-top: calc(var(--gap-block) - var(--header-h)); }
   Шапка резервирует место в потоке через margin-bottom: 100% (свой собственный
   height), поэтому контент стартует ПОСЛЕ прилипшей шапки, а не под ней; JS лишь
   компенсирует удвоение зазора у первого блока. ResizeObserver реагирует на смену
   контента (разные экраны, перенос строк, поворот), отступ всегда актуален. */
(function () {
    'use strict';

    function applyHeaderHeight() {
        var container = document.getElementById('app-content');
        if (!container) return;
        // Шапка — любой sticky-заголовок экрана: обычный, статистика,
        // детали записи истории или верхняя панель секундомера тренировки.
        var header = container.querySelector(
            ':scope > .screen-header, :scope > .stats-header, :scope > .sticky.top-0'
        );
        // getBoundingClientRect().height включает padding+border (то, что реально
        // перекрывает контент при скролле). Для шапки деталей (box-sizing:
        // content-box) border добавляем явно.
        var h = 0;
        if (header) {
            h = Math.ceil(header.getBoundingClientRect().height);
            var cs = getComputedStyle(header);
            if (cs.boxSizing === 'content-box') {
                h += Math.ceil(parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth));
            }
        }
        container.style.setProperty('--header-h', h + 'px');

        // Баннер суперсета (.sticky.top-2) липнет на 8px НИЖЕ нижней границы
        // шапки редактора. Так как шапки больше нет в DOM, «шаг» отступа
        // баннера (= высота удалённой шапки) компенсируем напрямую через top.
        var banner = container.querySelector('.sticky.top-2');
        if (banner) {
            // Компенсируем только «шаг» отступа (= высота удалённой шапки),
            // нижняя граница прилипания баннера — его собственный край.
            banner.style.top = 'calc(var(--sticky-top, 0px) - ' + h + 'px + 8px)';
        } else {
            container.style.removeProperty('--header-h');
        }
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
