/* ui/swipe-delete.js — универсальный жест «свайп влево» для элементов разметки.

   Как подключается: элементу достаточно атрибутов
       data-swipe-left="<имя действия>"  data-payload="<данные>"
   Внутри элемента ожидается слой-подложка .set-swipe-bg (красная зона «Удалить»)
   и основной контент .set-line-inner, который сдвигается пальцем.

   Логика: горизонтальный свайп влево по зоне (не по инпуту/кнопке) сдвигает строку;
   если отпущен дальше порога — вызывается обработчик из swipeLeftHandlers(action, payload),
   строка на короткое мгновение остаётся открытой (видна красная подложка), затем возвращается.
   Вертикальное движение не перехватывается — обычный скролл страницы работает.

   Реестр обработчиков пополняет фичевый модуль (features/workout/workout.controller.js)
   через registerSwipeLeftHandler(). */
'use strict';

const SWIPE_MIN_DX = 60;            // px: минимальное смещение влево для срабатывания
const SWIPE_AXIS_LOCK = 12;         // px: превысил по вертикали раньше — это скролл
const SWIPE_MAX_OPEN = 96;          // px: на сколько максимум сдвигаем строку

// Реестр: action → функция(action, payload).
const swipeLeftHandlers = {};
function registerSwipeLeftHandler(action, fn) { swipeLeftHandlers[action] = fn; }

(function initSwipeDelete() {
    let zone = null, inner = null, bg = null;
    let startX = 0, startY = 0;
    let locked = false;     // true: жест признан горизонтальным свайпом
    let curDx = 0;

    const INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT'];

    function isFieldTarget(target, z) {
        let cur = target;
        while (cur && cur !== document.body) {
            if (INTERACTIVE.indexOf(cur.tagName) !== -1) return true;   // ввод веса/повторов — не трогаем
            if (cur === z) break;
            cur = cur.parentElement;
        }
        return false;
    }

    function begin(target, x, y) {
        const z = target.closest ? target.closest('[data-swipe-left]') : null;
        if (!z) return;
        if (isFieldTarget(target, z)) return;
        zone = z;
        inner = z.querySelector('.set-line-inner');
        bg = z.querySelector('.set-swipe-bg');
        startX = x; startY = y; locked = false; curDx = 0;
    }

    function move(x, y) {
        if (!zone || !inner) return;
        const dx = x - startX, dy = y - startY;
        if (!locked) {
            if (Math.abs(dy) > SWIPE_AXIS_LOCK && Math.abs(dy) > Math.abs(dx)) { end(); return; } // вертикаль — скролл
            if (dx < -SWIPE_AXIS_LOCK && Math.abs(dx) > Math.abs(dy)) locked = true;             // горизонталь влево
            else return;
        }
        curDx = Math.max(-SWIPE_MAX_OPEN, Math.min(0, dx));
        inner.style.transition = 'none';
        inner.style.transform = 'translateX(' + curDx + 'px)';
        if (bg) bg.classList.add('visible');
    }

    function end() {
        if (!zone || !inner) { cleanup(); return; }
        const wasOpen = locked && curDx <= -SWIPE_MIN_DX;
        const action = zone.dataset.swipeLeft;
        const payload = zone.dataset.payload || '';
        resetVisual();
        const z = zone; cleanup();
        if (!wasOpen) return;
        try { haptic('medium'); } catch (e) {}
        if (z) z.classList.add('swipe-open');   // краткая подсветка удалённой строки до перерисовки DOM
        const handler = swipeLeftHandlers[action];
        if (!handler) { console.warn('Unhandled swipe-left action:', action); return; }
        try { handler(action, payload); }
        catch (err) { console.error('Swipe-left handler error:', action, err); }
    }

    function resetVisual() {
        if (inner) {
            inner.style.transition = 'transform 0.2s ease';
            inner.style.transform = '';
        }
        if (bg) bg.classList.remove('visible');
    }

    function cleanup() { zone = null; inner = null; bg = null; locked = false; curDx = 0; }

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) { cleanup(); return; }
            const t = e.touches[0];
            begin(e.target, t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!zone) return;
            const t = e.touches[0]; if (!t) return;
            move(t.clientX, t.clientY);
            // Перехватываем вертикальный скролл только когда жест уже стал горизонтальным свайпом.
            if (locked && e.cancelable) e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchend', end, { passive: true });
        document.addEventListener('touchcancel', function () { resetVisual(); cleanup(); }, { passive: true });
    }

    // Мышь (десктоп/отладка): свайп зажатой левой кнопкой.
    document.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        begin(e.target, e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', function (e) {
        if (!zone) return;
        move(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function () { if (zone) end(); });
})();
