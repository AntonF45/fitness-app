/* ui/swipe-delete.js — универсальный жест «свайп влево» для элементов разметки.

   Поведение повторяет удаление чата в Telegram:
     • красная подложка занимает всю ширину строки и «открывается» вслед за пальцем
       (строка уезжает влево, подложка раскрывается справа — scaleX от правого края);
     • если палец отпущен дальше порога — строка сама долетает до полного открытия
       (как в Telegram, подтверждение не нужно: жест уже осознанный);
     • затем строка схлопывается по высоте (анимация «выедания» соседями) и только
       после этого вызывается обработчик — он изменяет данные и перерисовывает карточку,
       поэтому соседние строки плавно подтягиваются на место удалённой;
     • если порог не достигнут — строка плавно возвращается на место.

   Как подключается: элементу достаточно атрибутов
       data-swipe-left="<имя действия>"  data-payload="<данные>"
   Внутри элемента ожидается слой-подложка .set-swipe-bg (красная зона «Удалить»)
   и основной контент .set-line-inner, который сдвигается пальцем.

   Почему через Pointer Events + setPointerCapture:
   раньше перехват touchmove вызывался только ПОСЛЕ распознавания горизонтали;
   WebView успевал отдать жест вертикальному скроллу, touchmove обрывался
   и удаление не срабатывало. Теперь при старте свайпа по зоне строка сразу
   перехватывает указатель (preventDefault), а capture гарантирует, что все события
   до отпускания придут в этот элемент — анимация следует за пальцем без рывков.

   Касание внутри поля ввода игнорируется — ввод веса/повторов работает как обычно.
   Вертикальное движение без горизонтали остаётся обычным скроллом.

   Реестр обработчиков пополняет фичевый модуль (features/workout/workout.controller.js)
   через registerSwipeLeftHandler(). */
'use strict';

const SWIPE_TRIGGER_DX = 50;        // px: смещение влево, при котором удаление срабатывает
const SWIPE_AXIS_TOLERANCE = 1.2;   // насколько вертикаль может опережать горизонталь до сброса жеста
const SWIPE_MAX_OPEN = 96;          // px: на сколько максимум сдвигаем строку (= ширина «окна» подложки)
const SWIPE_GLIDE_MS = 140;         // мс: долёт строки до полного открытия после отпускания
const SWIPE_COLLAPSE_MS = 220;      // мс: схлопывание высоты строки перед удалением из DOM

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
        let removed = false;     // строка уже «удаляется» — жесты игнорируем
        let startX = 0, startY = 0;
        let curDx = 0;
        let pid = null;

        function layers() {
            return {
                inner: zone.querySelector('.set-line-inner'),
                bg: zone.querySelector('.set-swipe-bg')
            };
        }

        // Ширина красной зоны = вся ширина строки (с запасом по краям), раскрывается от правого края.
        function bgWidth() { return (zone.clientWidth || 320) + 12; }

        // Строка сдвинута на px; подложка раскрывается вслед за пальцем (scaleX от правого края),
        // поэтому надпись «Удалить» остаётся на месте — как при удалении чата в Telegram.
        function setTransform(px, animate) {
            const l = layers();
            if (!l.inner) return;
            l.inner.style.transition = animate ? 'transform ' + SWIPE_GLIDE_MS + 'ms ease-out' : 'none';
            l.inner.style.transform = 'translateX(' + px + 'px)';
            if (l.bg) {
                const reveal = Math.min(1, Math.abs(px) / bgWidth());   // доля открытой зоны
                l.bg.style.transition = animate ? 'transform ' + SWIPE_GLIDE_MS + 'ms ease-out, opacity .15s ease' : 'none';
                l.bg.style.transform = 'scaleX(' + reveal.toFixed(3) + ')';
            }
        }

        // Финальная стадия: схлопываем высоту (соседи плавно подтягиваются), затем
        // перерисовка от обработчика — строка исчезает без «прыжка».
        function collapseAndDelete(action, payload) {
            removed = true;
            const h = zone.offsetHeight;
            zone.style.maxHeight = h + 'px';
            void zone.offsetHeight;                                   // reflow: фиксируем стартовую высоту
            zone.classList.add('set-collapsing');
            zone.style.maxHeight = '0px';
            zone.style.marginBottom = '0px';
            zone.style.opacity = '0';
            setTimeout(function () {
                const handler = swipeLeftHandlers[action];
                if (!handler) { console.warn('Unhandled swipe-left action:', action); resetZone(zone); return; }
                try { handler(action, payload); }                     // обработчик перерисовывает карточку
                catch (err) { console.error('Swipe-left handler error:', action, err); resetZone(zone); }
            }, SWIPE_COLLAPSE_MS);
        }

        zone.addEventListener('pointerdown', function (e) {
            if (removed) return;
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
            if (!active || removed || e.pointerId !== pid) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (dx < 0 && Math.abs(dy) <= Math.abs(dx) * SWIPE_AXIS_TOLERANCE) {
                // Горизонтальное движение — гасим системный скролл и подсветку WebKit.
                if (e.cancelable) e.preventDefault();
                zone.classList.add('swipe-active');
                try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
                const l = layers();
                if (l.bg) l.bg.classList.add('visible');
                // Строка идёт за пальцем без «пружины» — нет дёрганья; максимум — вся ширина зоны.
                curDx = Math.max(-Math.round(bgWidth()), Math.min(0, dx));
                setTransform(curDx, false);
            } else if (curDx !== 0) {
                // Пользователь увёл палец сильно вверх/вниз — возвращаем строку, но жест не бросаем.
                curDx = 0;
                setTransform(0, true);
            }
        }, { passive: false });

        function finish(e) {
            if (!active || removed || (e && e.pointerId !== pid)) return;
            active = false;
            zone.classList.remove('swipe-active');
            const fired = curDx <= -SWIPE_TRIGGER_DX;
            if (!fired) {
                // Не довели — плавный возврат строки.
                setTransform(0, true);
                const l = layers();
                if (l.bg) setTimeout(function () { if (curDx === 0) l.bg.classList.remove('visible'); }, SWIPE_GLIDE_MS);
                return;
            }
            const action = zone.dataset.swipeLeft;
            const payload = zone.dataset.payload || '';
            try { haptic('medium'); } catch (err) {}
            // Долёт «до конца» — как в Telegram: строка уходит за левый край, зона открыта полностью.
            setTransform(-Math.round(bgWidth()), true);
            const l = layers();
            if (l.bg) l.bg.classList.add('visible');
            setTimeout(function () { collapseAndDelete(action, payload); }, SWIPE_GLIDE_MS);
        }

        zone.addEventListener('pointerup', finish);
        zone.addEventListener('pointercancel', function (e) {
            if (!active || removed || e.pointerId !== pid) return;
            active = false;
            zone.classList.remove('swipe-active');
            setTransform(0, true);
            const l = layers();
            if (l.bg) setTimeout(function () { if (curDx === 0) l.bg.classList.remove('visible'); }, SWIPE_GLIDE_MS);
        });
    }

    // Возврат зоны в исходное состояние (если удаление не произошло).
    function resetZone(z) {
        z.classList.remove('swipe-open', 'set-collapsing');
        const i = z.querySelector('.set-line-inner');
        const b = z.querySelector('.set-swipe-bg');
        if (i) { i.style.transition = 'transform 0.2s ease'; i.style.transform = ''; }
        if (b) { b.style.transition = 'transform 0.2s ease, opacity .15s ease'; b.style.transform = ''; b.classList.remove('visible'); }
        z.style.maxHeight = '';
        z.style.marginBottom = '';
        z.style.opacity = '';
        z.dataset.removedBySwipe = '';
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
