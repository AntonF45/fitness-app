/* Стекло sticky-шапок (--glass-bg).
   Задача: фон шапки = 95% цвета фона приложения (как bg-tgBg/95 у секундомера)
   + backdrop blur. Чистый CSS тут не работает стабильно: color-mix() с
   transparent на старых WebView падает в сплошную заливку, а сам
   --tg-theme-bg-color иногда приходит как #RRGGBBAA — rgba() от такого нужно
   строить вручную. Поэтому значение пишет JS, а CSS-фолбэк — прозрачный. */
(function () {
    'use strict';

    var ALPHA = 0.95;

    function parseColor(str) {
        if (!str) return null;
        str = String(str).trim();
        // #RGB / #RGBA / #RRGGBB / #RRGGBBAA
        var m = str.match(/^#([0-9a-f]{3,8})$/i);
        if (m) {
            var h = m[1];
            if (h.length === 3 || h.length === 4) {
                return {
                    r: parseInt(h[0] + h[0], 16),
                    g: parseInt(h[1] + h[1], 16),
                    b: parseInt(h[2] + h[2], 16)
                };
            }
            if (h.length >= 6) {
                return {
                    r: parseInt(h.slice(0, 2), 16),
                    g: parseInt(h.slice(2, 4), 16),
                    b: parseInt(h.slice(4, 6), 16)
                };
            }
            return null;
        }
        // rgb(a)?(...)
        m = str.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
        if (m) return { r: +m[1], g: +m[2], b: +m[3] };
        return null;
    }

    function applyGlass() {
        try {
            var cs = getComputedStyle(document.documentElement);
            var c = parseColor(cs.getPropertyValue('--tg-theme-bg-color'));
            if (!c) return; /* фолбэк в CSS остаётся прозрачным */
            document.documentElement.style.setProperty(
                '--glass-bg',
                'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + ALPHA + ')'
            );
        } catch (e) { /* не ронять приложение из-за декоративной правки */ }
    }

    applyGlass();
    window.addEventListener('load', applyGlass);
})();
