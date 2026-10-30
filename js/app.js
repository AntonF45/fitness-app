/* js/app.js — точка входа. Порядок <script>-тегов в index.html задаёт зависимости. */
'use strict';

(function init() {
    try {
        resetSetDraftsOnLoad();
        if (restoreActiveWorkout()) navigate('workout'); else navigateToTab('programs');
    } catch (err) {
        console.error('Init error:', err);
        const m = document.getElementById('app-content');
        if (m) m.innerHTML = '<div style="padding:16px;color:#f87171;font-size:14px;line-height:1.5">Ошибка запуска: ' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
    }
})();
