/* ui/swipe-delete.js — универсальный жест «свайп влево» для элементов разметки.

   Как подключается: элементу достаточно атрибутов
       data-swipe-left="<имя действия>"  data-payload="<данные>"
   Внутри элемента ожидается слой-подложка .set-swipe-bg (красная зона «Удалить»)
   и основной контент .set-line-inner, который сдвигается пальцем.

   Почему через Pointer Events + setPointerCapture:
   раньше перехват touchmove вызывался только ПОСЛЕ распознавания горизонтали;
   WebView успевал отдать жест вертикальному скроллу, touchmove обрывался
   и удаление не срабатывало. Теперь при старте свайпа по зоне строки движение
   перехватывается сразу (preventDefault), а capture гарантирует, что все события
   до отпускания придут в этот элемент — анимация следует за пальцем без рывков.

   Логика: горизонтальное движение плавно сдвигает строку за пальцем; если отпущено
   дальше порога — строка одним плавным glide доезжает до полного открытия и после
   короткой паузы вызывается обработчик из swipeLeftHandlers (он перерисовывает DOM —
   строка исчезает). Касание внутри поля ввода/кнопок ± игнорируется — они работают
   как обычно. Вертикальное движение без горизонтали остаётся обычным скроллом.

   Реестр обработчиков пополняет фичевый модуль (features/workout/workout.controller.js)
   через registerSwipeLeftHandler(). */
'use strict';

const SWIPE_TRIGGER_DX = 50;        // px: смещение влево, при котором удаление срабатывает
const SWIPE_AXIS_TOLERANCE = 1.2;   // насколько вертикаль может опережать горизонталь до сброса жеста
const SWIPE_MAX_OPEN = 96;          // px: на сколько максимум сдвигаем строку (= ширина подложки)
const SWIPE_DELETE_DELAY = 130;     // мс: пауза на анимацию «полного открытия» перед удалением

// Реестр: action → функция(action, payload).
const swipeLeftHandlers = {};
function registerSwipeLeftHandler(action, fn) { swipeLeftHandlers[action] = fn; }

(function initSwipeDelete() {
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

    // Привязка свайпа к конкретной строке подхода.
    function attachZone(zone) {
        if (!zone || zone.dataset.swipeBound === '1') return;
        zone.dataset.swipeBound = '1';

        let active = false;      // этот pointer ведёт свайп
        let startX = 0, startY = 0;
        let curDx = 0;
        let pid = null;
        const inner = zone.querySelector('.set-line-inner');
        const bg = zone.querySelector('.set-swipe-bg');

        function setTransform(px, animate) {
            if (!inner) return;
            inner.style.transition = animate ? 'transform 0.14s ease-out' : 'none';
            inner.style.transform = 'translateX(' + px + 'px)';
        }

        zone.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (isFieldTarget(e.target, zone)) return;
            active = true;
            pid = e.pointerId;
            startX = e.clientX; startY = e.clientY; curDx = 0;
            // Перехватываем указатель: все pointermove/up придут сюда, даже вне зоны.
            try { zone.setPointerCapture(pid); } catch (err) {}
            setTransform(0, false);
        });

        zone.addEventListener('pointermove', function (e) {
            if (!active || e.pointerId !== pid) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (dx < 0 && Math.abs(dy) <= Math.abs(dx) * SWIPE_AXIS_TOLERANCE) {
                // Горизонтальное движение — гасим системный скролл и подсветку WebKit.
                if (e.cancelable) e.preventDefault();
                zone.classList.add('swipe-active');
                try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
                if (bg) bg.classList.add('visible');
                curDx = Math.max(-SWIPE_MAX_OPEN, Math.min(0, dx));
                setTransform(curDx, false);           // строго за пальцем, без пружины — нет «дёрганья»
            } else if (curDx !== 0) {
                // Пользователь увёл палец сильно вверх/вниз — возвращаем строку, но жест не бросаем.
                curDx = 0;
                setTransform(0, true);
            }
        }, { passive: false });

        function finish(e) {
            if (!active || (e && e.pointerId !== pid)) return;
            active = false;
            zone.classList.remove('swipe-active');
            const fired = curDx <= -SWIPE_TRIGGER_DX;
            if (!fired) {
                // Не довели — плавный возврат строки.
                setTransform(0, true);
                if (bg) setTimeout(function () { bg.classList.remove('visible'); }, 180);
                return;
            }
            const action = zone.dataset.swipeLeft;
            const payload = zone.dataset.payload || '';
            try { haptic('medium'); } catch (err) {}
            setTransform(-SWIPE_MAX_OPEN, true);      // один плавный glide до полного открытия
            if (bg) bg.classList.add('visible');
            setTimeout(function () {
                const handler = swipeLeftHandlers[action];
                if (!handler) { console.warn('Unhandled swipe-left action:', action); resetZone(zone); return; }
                try { handler(action, payload); }     // обработчик перерисовывает карточку — строка исчезает
                catch (err) { console.error('Swipe-left handler error:', action, err); resetZone(zone); }
            }, SWIPE_DELETE_DELAY);
        }

        zone.addEventListener('pointerup', finish);
        zone.addEventListener('pointercancel', function (e) {
            if (!active || e.pointerId !== pid) return;
            active = false;
            zone.classList.remove('swipe-active');
            setTransform(0, true);
            if (bg) bg.classList.remove('visible');
        });
    }

    // Возврат зоны в исходное состояние (если удаление не произошло).
    function resetZone(z) {
        z.classList.remove('swipe-open');
        const i = z.querySelector('.set-line-inner');
        const b = z.querySelector('.set-swipe-bg');
        if (i) { i.style.transition = 'transform 0.2s ease'; i.style.transform = ''; }
        if (b) b.classList.remove('visible');
    }

    // Глобальная делегирующая привязка: работает и для новых строк после перерисовки карточки.
    const MO = new MutationObserver(function (muts) {
        for (let i = 0; i < muts.length; i++) {
            const added = muts[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
                const n = added[j];
                if (n.nodeType !== 1) continue;
                if (n.matches && n.matches('[data-swipe-left]')) attachZone(n);
                if (n.querySelectorAll) {
                    const list = n.querySelectorAll('[data-swipe-left]');
                    for (let k = 0; k < list.length; k++) attachZone(list[k]);
                }
            }
        }
    });
    function startObserving() { MO.observe(document.body, { childList: true, subtree: true }); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
})();
