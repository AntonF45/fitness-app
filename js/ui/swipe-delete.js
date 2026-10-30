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

// Кросс-платформенный «следующий кадр»: в Telegram WebView и обычных браузерах
// это requestAnimationFrame; если rAF недоступен — мгновенный setTimeout(0),
// чтобы схлопывание никогда не зависело от наличия этой API.
function nextFrame(fn) {
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(fn); return; }
    setTimeout(fn, 0);
}

// Отмена долгого нажатия на этой же строке, когда распознан свайп (жесты не должны спорить).
function cancelLongPressOn(zone) {
    try { if (typeof cancelLongPress === 'function') cancelLongPress(zone); } catch (err) {}
}

// Служебная DOM-утилита: касание внутри поля ввода игнорируется — ввод веса/повторов
// работает как обычно.
const SWIPE_INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT'];

function swipeIsFieldTarget(target, z) {
    let cur = target;
    while (cur && cur !== document.body) {
        if (SWIPE_INTERACTIVE.indexOf(cur.tagName) !== -1) return true;
        if (cur === z) break;
        cur = cur.parentElement;
    }
    return false;
}

(function initSwipeDelete() {
    function isFieldTarget(target, z) { return swipeIsFieldTarget(target, z); }

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
        // clientWidth может быть 0, если строка ещё не отрисована — берём offsetWidth как резерв.
        function bgWidth() { return (zone.clientWidth || zone.offsetWidth || 320) + 12; }

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

        // Финальная стадия: сначала изменяем ДАННЫЕ (обработчик), затем схлопываем
        // именно тот DOM-узел, который пользователь свайпнул, и удаляем его из дерева.
        function collapseAndDelete(action, payload) {
            removed = true;

            // 0) Переводим строку в статичный режим: отвязываем анимацию появления
            //    (card-enter), чтобы keyframes «both» с финальным opacity:1 не
            //    перебивал inline opacity:0 при схлопывании, и убираем сдвиг по X
            //    (строка остаётся на месте, пока высота «съедается» соседями).
            zone.classList.remove('card-enter');
            setTransform(0, false);

            // 1) Меняем данные. Обработчик вызывает removeSet → updateExerciseCardInDOM
            //    → syncSetsListInPlace. Чтобы перерисовка НЕ удалила эту строку раньше
            //    времени (иначе анимация срывается и выглядит как «ничего не произошло»),
            //    строка помечается заранее: swipeAnimating + dataset.swipeRemoving —
            //    оба флага syncSetsListInPlace учитывает (см. workout.controller.js).
            zone.swipeAnimating = true;
            zone.dataset.swipeRemoving = '1';
            const handler = swipeLeftHandlers[action];
            if (!handler) { console.warn('Unhandled swipe-left action:', action); resetZone(zone); return; }
            try { handler(action, payload); }
            catch (err) { console.error('Swipe-left handler error:', action, err); resetZone(zone); return; }

            // 2) Схлопываем узел, свайпнутый пользователем.
            const h = zone.offsetHeight || 48;
            zone.style.maxHeight = h + 'px';
            void zone.offsetHeight;                                   // reflow: фиксируем стартовую высоту
            zone.classList.add('set-collapsing');
            nextFrame(function () {
                zone.style.maxHeight = '0px';
                zone.style.marginBottom = '0px';
                zone.style.opacity = '0';
            });

            // 3) Убираем строку из DOM ровно один раз (колбэк или страховочный таймер).
            let finalized = false;
            function finalize() {
                if (finalized) return;
                finalized = true;
                zone.removeEventListener('transitionend', onEnd);
                zone.removeEventListener('webkitTransitionEnd', onEnd);
                zone.swipeAnimating = false;                          // снимаем защиту перед sync
                delete zone.dataset.swipeRemoving;
                if (zone.parentNode) zone.remove();                   // parentNode, а не body.contains:
                                                                      // узел может быть внутри shadow-DOM/иного корня
                // Данные уже удалены; если экран всё же перерисован целиком —
                // подход в новом дереве не появится. Подстрахуемся на всякий случай.
                const twin = zone.id ? document.getElementById(zone.id) : null;
                if (twin && twin !== zone) twin.remove();
                // После удаления строки перенумеровываем оставшиеся подходы и
                // обновляем их data-payload (иначе свайп следующей строки удалит
                // подход со старым индексом).
                try {
                    const p = String(payload).split(':');
                    const exIdx = parseInt(p[0], 10);
                    const ex = (typeof state !== 'undefined' && state.activeWorkout &&
                                state.activeWorkout.exercises) ? state.activeWorkout.exercises[exIdx] : null;
                    if (ex && typeof syncSetsListInPlace === 'function') syncSetsListInPlace(exIdx, ex);
                    if (typeof window.bindSwipeZones === 'function') window.bindSwipeZones();
                } catch (err) {}
            }
            function onEnd(e) {
                // Реагируем только на завершение схлопывания самой строки.
                if (e && e.target !== zone) return;
                if (e && e.propertyName && e.propertyName.indexOf('height') === -1 &&
                          e.propertyName !== 'max-height') return;
                clearTimeout(safety);
                finalize();
            }
            const safety = setTimeout(finalize, SWIPE_COLLAPSE_MS + 140);
            zone.addEventListener('transitionend', onEnd);
            zone.addEventListener('webkitTransitionEnd', onEnd);
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
    } // ── конец attachZone ──

    // Возврат зоны в исходное состояние (если удаление не произошло).
    // ВАЖНО: функция объявлена на том же уровне видимости, что и attachZone —
    // иначе вызов resetZone(zone) изнутри attachZone падал бы с ReferenceError
    // и весь путь удаления молча прерывался (подход не удалялся).
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
        delete z.dataset.swipeRemoving;
    }

    // Привязка всех уже существующих строк (вызывается при старте и после каждой
    // перерисовки экрана — attachZone идемпотентен благодаря data-swipe-bound).
    function bindAllExisting() {
        const list = document.querySelectorAll('[data-swipe-left]');
        for (let i = 0; i < list.length; i++) attachZone(list[i]);
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
    function startObserving() {
        MO.observe(document.body, { childList: true, subtree: true });
        bindAllExisting();   // строки, отрисованные до старта наблюдателя
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
    // Страховка: если экран тренировки уже смонтирован и наблюдатель по какой-то
    // причине не привязал строки — привязать их напрямую.
    window.bindSwipeZones = bindAllExisting;
    document.addEventListener('workout:rendered', bindAllExisting);
})();
