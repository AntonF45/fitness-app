/* ui/swipe-delete.js — универсальный жест «свайп влево» для элементов разметки.

   Как подключается: элементу достаточно атрибутов
       data-swipe-left="<имя действия>"  data-payload="<данные>"
   Внутри элемента ожидается слой-подложка .set-swipe-bg (красная зона «Удалить»)
   и основной контент .set-line-inner, который сдвигается пальцем.

   Логика: горизонтальный свайп влево по зоне (не по инпуту/кнопке) плавно сдвигает
   строку за пальцем; если отпущен дальше порога — строка анимируется к полному
   открытию и после короткой паузы вызывается обработчик из swipeLeftHandlers
   (обработчик перерисовывает DOM — строка исчезает). Вертикальное движение не
   перехватывается — обычный скролл страницы работает.

   Реестр обработчиков пополняет фичевый модуль (features/workout/workout.controller.js)
   через registerSwipeLeftHandler(). */
'use strict';

const SWIPE_MIN_DX = 50;            // px: минимальное смещение влево для срабатывания
const SWIPE_AXIS_LOCK = 8;          // px: превысил по вертикали раньше — это скролл
const SWIPE_MAX_OPEN = 96;          // px: на сколько максимум сдвигаем строку (= ширина подложки)
const SWIPE_DELETE_DELAY = 140;     // мс: пауза на анимацию «полного открытия» перед удалением

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
        // Жёсткий сброс трансформации — иначе «дёрганье» при повторных жестах,
        // если предыдущая анимация возврата не завершилась.
        if (inner) { inner.style.transition = 'none'; inner.style.transform = ''; }
    }

    // Плавный возврат строки в исходное положение.
    function glideHome(i, ms) {
        if (!i) return;
        i.style.transition = 'transform ' + (ms || 200) + 'ms cubic-bezier(0.22, 0.61, 0.36, 1)';
        i.style.transform = 'translateX(0)';
    }

    function move(x, y) {
        if (!zone || !inner) return;
        const dx = x - startX, dy = y - startY;
        if (!locked) {
            if (Math.abs(dy) > SWIPE_AXIS_LOCK && Math.abs(dy) > Math.abs(dx)) { abort(); return; } // вертикаль — скролл
            if (dx < -SWIPE_AXIS_LOCK && Math.abs(dx) > Math.abs(dy)) {
                locked = true;
                zone.classList.add('swipe-active');      // сбрасываем iOS callout/подсветку на время жеста
                try { document.getSelection && document.getSelection().removeAllRanges(); } catch (e) {}
                if (bg) bg.classList.add('visible');
            } else return;
        }
        // Смещение строго за пальцем без пружины за краями — так нет «дёрганья».
        curDx = Math.max(-SWIPE_MAX_OPEN, Math.min(0, dx));
        inner.style.transition = 'none';
        inner.style.transform = 'translateX(' + curDx + 'px)';
    }

    function end() {
        if (!zone || !inner) { cleanup(); return; }
        const z = zone, i = inner, b = bg;
        const action = z.dataset.swipeLeft;
        const payload = z.dataset.payload || '';
        cleanup();
        z.classList.remove('swipe-active');
        if (!locked || curDx > -SWIPE_MIN_DX) {
            // Не довели — плавный возврат строки.
            if (i) { i.style.transition = 'transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)'; i.style.transform = 'translateX(0)'; }
            if (b) b.classList.remove('visible');
            return;
        }
        // Сработало: плавно доводим строку до полного открытия подложки, затем удаляем.
        try { haptic('medium'); } catch (e) {}
        if (i) {
            i.style.transition = 'transform 0.14s ease-out';
            i.style.transform = 'translateX(-' + SWIPE_MAX_OPEN + 'px)';   // один плавный glide вместо рывка анимацией
        }
        if (b) b.classList.add('visible');
        setTimeout(function () {
            const handler = swipeLeftHandlers[action];
            if (!handler) { console.warn('Unhandled swipe-left action:', action); resetZone(z); return; }
            try { handler(action, payload); }         // обработчик перерисовывает карточку — строка исчезает
            catch (err) { console.error('Swipe-left handler error:', action, err); resetZone(z); }
        }, SWIPE_DELETE_DELAY);
    }

    // Возврат зоны в исходное состояние (если удаление не произошло).
    function resetZone(z) {
        z.classList.remove('swipe-open');
        const i = z.querySelector('.set-line-inner');
        const b = z.querySelector('.set-swipe-bg');
        if (i) {
            i.style.transition = 'transform 0.2s ease';
            i.style.transform = '';
        }
        if (b) b.classList.remove('visible');
    }

    function abort() {           // жест прерван (вертикальный скролл) — просто возвращаем
        const z = zone, i = inner, b = bg;
        cleanup();
        if (z) z.classList.remove('swipe-active');
        glideHome(i, 180);
        if (b) b.classList.remove('visible');
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
        document.addEventListener('touchcancel', abort, { passive: true });
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
