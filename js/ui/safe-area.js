/* ui/safe-area.js — системные безопасные зоны Telegram (upper content area, учёт кнопки
   «Закрыть» в полноэкранном режиме) и подписка на изменения инсетов. */
'use strict';

function applySafeAreaInsets() {
    try {
        const st = document.documentElement.style;
        const sa = tg.contentSafeAreaInset || tg.safeAreaInset || null;
        if (sa) {
            if (typeof sa.top === 'number' && sa.top >= 0) st.setProperty('--safe-top', sa.top + 'px');
            if (typeof sa.bottom === 'number' && sa.bottom >= 0) st.setProperty('--safe-bottom', sa.bottom + 'px');
        }
        // Высота системной кнопки «Закрыть» в fullscreen;
        // состояние берём из tg.isFullscreen, а если его нет — из собственного флага
        const fs = currentFullscreen();
        const closeBtn = (TG_PLATFORM.indexOf('android') !== -1) ? 48 : 44;
        st.setProperty('--extra-top', (fs ? closeBtn : 0) + 'px');
        console.log('[Fitnary] insets:', JSON.stringify(sa), 'fullscreen:', fs, 'extra-top:', fs ? closeBtn : 0);
    } catch (e) {}
}

applySafeAreaInsets();
enterMobileFullscreen();
try {
    if (tg.onEvent) {
        tg.onEvent('safeAreaChanged', applySafeAreaInsets);
        tg.onEvent('contentSafeAreaChanged', applySafeAreaInsets);
        tg.onEvent('fullscreenChanged', applySafeAreaInsets);
    }
} catch (e) {}
