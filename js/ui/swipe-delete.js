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

   Почему реализация на Touch Events (а не Pointer Events):
   Telegram для iOS — это WKWebView. В нём есть pointerdown/pointermove, но нет
   pointerup/pointercancel (до Safari 14.5 не было вообще). Поэтому на iPhone
   «долёт до конца» и схлопывание, привязанные к pointerup, никогда не выполнялись —
   свайп открывал красную зону, но до конца не отрабатывал.
   Здесь:
     • touchstart/touchmove/touchend — нативные события, работают во всех WebView;
     • touchmove слушается на window в ФАЗЕ ЗАХВАТА (capture), поэтому даже если
       цель касания — кнопка −/+ или span с единицей, мы получаем событие раньше
       них и можем вызвать preventDefault (на element-level listener это уже
       не действует: браузер считает цель неcancelable);
     • координаты берутся из e.touches[0] / e.changedTouches[0]; порог срабатывания
       замеряется отдельно (triggerDx) — иначе вертикальный дрейф пальца завышал dx
       и удаление срабатывало раньше времени;
     • ориентация жеста определяется по первому ходу пальца: движение вправо или
       сильнее по вертикали, чем по горизонтали, жестом не считается (скроллит страница).

   Касание внутри поля ввода игнорируется — ввод веса/повторов работает как обычно.
   Свайп отменяет ожидаемое долгое нажатие — они не конкурируют.

   Реестр обработчиков пополняет фичевый модуль (features/workout/workout.controller.js)
   через registerSwipeLeftHandler(). */
'use strict';

const SWIPE_TRIGGER_DX = 50;        // px: горизонтальное смещение, при котором удаление срабатывает
const SWIPE_START_SLOP = 8;         // px: пока не пройдено это смещение — решаем, свайп это или скролл
const SWIPE_GLIDE_MS = 140;         // мс: долёт строки до полного открытия после отпускания
const SWIPE_COLLAPSE_MS = 220;      // мс: схлопывание высоты строки перед удалением из DOM

// Реестр: action → функция(action, payload).
const swipeLeftHandlers = {};
function registerSwipeLeftHandler(action, fn) { swipeLeftHandlers[action] = fn; }

// Отмена долгого нажатия на этой же строке, когда распознан свайп (жесты не должны спорить).
function cancelLongPressOn(zone) {
    try { if (typeof cancelLongPress === 'function') cancelLongPress(zone); } catch (err) {}
}

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

    function pointOf(e) {
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        return t ? { x: t.clientX, y: t.clientY } : { x: e.clientX, y: e.clientY };
    }

    // Привязка свайпа к конкретной строке подхода.
    function attachZone(zone) {
        if (!zone || zone.dataset.swipeBound === '1') return;
        zone.dataset.swipeBound = '1';

        let tracking = false;    // касание есть, но ориентация жеста ещё не определена
        let engaged = false;     // свайп перехвачен (строка движется за пальцем)
        let decided = false;     // первый ход сделан (горизонталь/вертикаль распознаны)
        let removed = false;     // строка уже «удаляется» — жесты игнорируем
        let startX = 0, startY = 0;
        let curDx = 0;           // текущий сдвиг строки (для возврата при отмене)
        let triggerDx = 0;       // чисто горизонтальное смещение — для порога срабатывания

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

        function showBg() {
            const l = layers();
            if (l.bg) l.bg.classList.add('visible');
        }

        // Плавный возврат строки на место и скрытие подложки.
        function springBack() {
            curDx = 0; triggerDx = 0;
            setTransform(0, true);
            const l = layers();
            if (l.bg) setTimeout(function () { if (curDx === 0) l.bg.classList.remove('visible'); }, SWIPE_GLIDE_MS);
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

        // ── touchstart: начинаем следить за касанием этой строки ──
        zone.addEventListener('touchstart', function (e) {
            if (removed) return;
            if (e.touches.length !== 1) return;                       // мультитач не обслуживаем
            if (isFieldTarget(e.target, zone)) return;
            const p = pointOf(e);
            tracking = true; engaged = false; decided = false;
            startX = p.x; startY = p.y; curDx = 0; triggerDx = 0;
            setTransform(0, false);
        }, { passive: true });

        // ── touchmove: слушается НА WINDOW В ФАЗЕ ЗАХВАТА ──
        // Так событие приходит раньше, чем его получит кнопка/поле внутри строки,
        // и preventDefault гарантированно работает (отменяет нативный скролл).
        function onTouchMove(e) {
            if (!tracking || removed) return;
            const p = pointOf(e);
            const dx = p.x - startX, dy = p.y - startY;

            if (!decided) {
                // Первый ход: определяем ориентацию жеста.
                if (Math.abs(dx) < SWIPE_START_SLOP && Math.abs(dy) < SWIPE_START_SLOP) return;
                decided = true;
                if (dx >= 0 || Math.abs(dy) > Math.abs(dx)) {
                    tracking = false;                                 // вертикаль/вправо — пусть скроллит
                    return;
                }
                engaged = true;                                       // свайп влево — перехватываем
                cancelLongPressOn(zone);
                zone.classList.add('swipe-active');
                showBg();
            }

            if (!engaged) return;
            if (e.cancelable) e.preventDefault();                     // гасим системный скролл/подсветку
            try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
            triggerDx = dx;                                           // порог меряем по чистой горизонтали
            // Строка идёт за пальцем без «пружины»; максимум — вся ширина зоны.
            curDx = Math.max(-Math.round(bgWidth()), Math.min(0, dx));
            setTransform(curDx, false);
        }
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

        // ── завершение жеста: touchend / touchcancel ──
        function finish(e) {
            if (!tracking || removed) return;
            tracking = false;
            const wasEngaged = engaged;
            engaged = false;
            zone.classList.remove('swipe-active');
            if (!wasEngaged) return;                                  // ничего не двигали — обычное нажатие

            if (triggerDx <= -SWIPE_TRIGGER_DX) {
                // Порог пройден: долёт «до конца» — как в Telegram: строка уходит за левый край,
                // зона открыта полностью, затем схлопывание и удаление из данных.
                const action = zone.dataset.swipeLeft;
                const payload = zone.dataset.payload || '';
                try { haptic('medium'); } catch (err) {}
                showBg();
                setTransform(-Math.round(bgWidth()), true);
                setTimeout(function () { collapseAndDelete(action, payload); }, SWIPE_GLIDE_MS);
            } else {
                springBack();                                         // не довели — плавный возврат
            }
        }

        zone.addEventListener('touchend', finish, { passive: true });
        function onTouchCancel() {
            if (!tracking || removed) return;
            const wasEngaged = engaged;
            tracking = false; decided = false; engaged = false;
            zone.classList.remove('swipe-active');
            if (wasEngaged) springBack();                             // браузер забрал жест (скролл) — возвращаем
        }
        zone.addEventListener('touchcancel', onTouchCancel, { passive: true });
        // Страховка: touchcancel приходит не во всех WebView (например, при системном
        // прерывании) — дублируем сброс на window в фазе всплытия.
        window.addEventListener('touchcancel', onTouchCancel, { passive: true });
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
