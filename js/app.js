/* js/app.js — точка входа: последовательность загрузки модулей и инициализация приложения.
   Порядок <script>-тегов в index.html задаёт зависимости (классический режим без ES-модулей,
   т.к. Telegram WebApp отдаёт один HTML без сборки). */
'use strict';

// === ЗАПУСК С ЗАЩИТОЙ ОТ ОШИБОК ===
(function init() {
    try {
        if (restoreActiveWorkout()) navigate('workout'); else navigateToTab('programs');
    } catch (err) {
        console.error('Init error:', err);
        const m = document.getElementById('app-content');
        if (m) m.innerHTML = '<div style="padding:16px;color:#f87171;font-size:14px;line-height:1.5">Ошибка запуска: ' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
    }
})();
