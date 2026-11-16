/* core/scroll-nav.js — автоскрытие нижней навигации и плавающих кнопок.

   При прокрутке ВНИЗ (чтение списка) панель #bottom-nav и кнопка
   .sticky-bottom-action уходят за нижний край — экран становится выше.
   При прокрутке ВВЕРХ или в самом верху страницы — возвращаются.

   Только UI: логика, состояние и роутинг не затрагиваются.
   Скрытое состояние — класс body.nav-hidden (стили в styles.css). */
'use strict';

(function init() {
    var THRESHOLD = 14;      // минимальное смещение, чтобы сменить состояние
    var lastY = window.scrollY || 0;
    var hidden = false;

    function setHidden(v) {
        if (hidden === v) return;
        hidden = v;
        document.body.classList.toggle('nav-hidden', v);
    }

    // Плавающая кнопка может иметь разный offset снизу (var(--bottom-pos)) —
    // сообщаем CSS её реальную высоту позиции для корректного translateY.
    function publishBottomPos() {
        var el = document.querySelector('.sticky-bottom-action');
        if (!el) return;
        var r = el.getBoundingClientRect();
        document.documentElement.style.setProperty(
            '--bottom-pos', Math.round(window.innerHeight - r.bottom) + 'px');
    }

    function onScroll() {
        var y = window.scrollY || 0;
        var maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        if (y <= THRESHOLD) { setHidden(false); lastY = y; return; } // всегда видно вверху
        if (y >= maxScroll - 2) { setHidden(false); lastY = y; return; } // и в самом низу

        if (y > lastY + THRESHOLD) { setHidden(true); lastY = y; }
        else if (y < lastY - THRESHOLD) { setHidden(false); lastY = y; }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { publishBottomPos(); }, { passive: true });

    // После перерисовки экрана пересчитываем позицию кнопки и сбрасываем
    // скрытие (новый экран начинается сверху — панель должна быть видна).
    var container = document.getElementById('app-content');
    if (container && typeof MutationObserver !== 'undefined') {
        var rafPending = false;
        new MutationObserver(function () {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(function () {
                rafPending = false;
                publishBottomPos();
                lastY = window.scrollY || 0;
                setHidden(lastY <= THRESHOLD);
            });
        }).observe(container, { childList: true });
    }

    publishBottomPos();
})();
