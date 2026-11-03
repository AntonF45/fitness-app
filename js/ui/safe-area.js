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
        // Полоса Telegram с кнопками «Закрыть/Назад» и «Свернуть/⋮» занимает верхнюю зону
        // ВСЕГДА (и в обычном, и в полноэкранном режиме), поэтому резервируем её высоту
        // всегда — иначе sticky-заголовки при скролле уходят под системные кнопки.
        const closeBtn = (TG_PLATFORM.indexOf('android') !== -1) ? 56 : 52;
        st.setProperty('--extra-top', closeBtn + 'px');
        console.log('[Fitnary] insets:', JSON.stringify(sa), 'extra-top:', closeBtn);
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
