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

        // Финальная стадия. ПОРЯДОК КРИТИЧЕН:
        //   1) сначала визуально схлопываем и удаляем из DOM ИМЕННО ту строку,
        //      которую свайпнул пользователь;
        //   2) только потом меняем данные (handler → removeSet → sync/pererisovka).
        // Если делать наоборот (как было раньше), перерисовка могла отсоединить
        // наш узел до анимации: transitionend не наступал, и пользователь видел
        // либо мгновенный «телепорт», либо «ничего не произошло».
        // Дополнительно ставится guard-таймер: если через N мс после handler()
        // строка с тем же id снова появилась в DOM (перерисовка вернула её),
        // она удаляется принудительно — подход не может «воскреснуть».
        function collapseAndDelete(action, payload) {
            removed = true;

            // Защита от «воскрешения»: узел заморожен для sync до самой финализации.
            zone.swipeAnimating = true;
            zone.dataset.swipeRemoving = '1';

            // 1) Готовим схлопывание: отвязываем анимацию появления (card-enter),
            //    чтобы keyframes «both» с финальным opacity:1 не перебивал inline
            //    opacity:0; обнуляем transform (строка встаёт на место) и фиксируем
            //    стартовую высоту ЯВНО — переход max-height работает только между
            //    двумя конкретными значениями (none → 0 анимируется скачком).
            zone.classList.remove('card-enter');
            const l = layers();
            if (l.inner) l.inner.style.transform = '';
            if (l.bg) { l.bg.style.transform = ''; l.bg.classList.remove('visible'); }
            const h = zone.offsetHeight || 48;
            zone.style.maxHeight = h + 'px';
            void zone.offsetHeight;                                   // reflow: фиксируем стартовую высоту
            zone.classList.add('set-collapsing');                     // класс содержит transition по max-height
            nextFrame(function () {
                zone.style.maxHeight = '0px';
                zone.style.marginBottom = '0px';
                zone.style.opacity = '0';
            });

            // 2) Завершение: ровно один раз.
            let finalized = false;
            function finalize() {
                if (finalized) return;
                finalized = true;
                zone.removeEventListener('transitionend', onEnd);
                zone.removeEventListener('webkitTransitionEnd', onEnd);
                if (zone.parentNode) zone.remove();                   // parentNode, а не body.contains:
                                                                      // узел может быть внутри shadow-DOM/иного корня
                zone.swipeAnimating = false;                          // снимаем защиту ПЕРЕД обработчиком данных
                delete zone.dataset.swipeRemoving;

                // 3) Теперь можно менять данные: removeSet → updateExerciseCardInDOM
                //    → syncSetsListInPlace. Строка уже вне DOM, поэтому sync просто
                //    перенумерует оставшиеся ряды и обновит payload'ы.
                const handler = swipeLeftHandlers[action];
                if (!handler) {
                    console.warn('Unhandled swipe-left action:', action);
                    resetZone(zone);
                    return;
                }
                try { handler(action, payload); }
                catch (err) { console.error('Swipe-left handler error:', action, err); }

                // Данные уже обновлены обработчиком; дополнительно синхронизируем
                // список на месте и перепривязываем свайп-зоны. ВАЖНО: badge НЕ
                // трогаем — это ответственность updateExerciseCardInDOM внутри
                // removeSet (иначе здесь считали бы countCompletedSets по уже
                // устаревшей нумерации строк и «закрепляли» неверный статус).
                try {
                    const p = String(payload).split(':');
                    const exIdx = parseInt(p[0], 10);
                    const ex = (typeof state !== 'undefined' && state.activeWorkout &&
                                state.activeWorkout.exercises) ? state.activeWorkout.exercises[exIdx] : null;
                    if (ex && typeof syncSetsListInPlace === 'function') syncSetsListInPlace(exIdx, ex);
                    if (typeof window.bindSwipeZones === 'function') window.bindSwipeZones();
                } catch (err) {}

                // Guard против «воскрешения»: если перерисовка (sync или полная
                // отрисовка экрана) всё же вернула в DOM узел с тем же id, что и
                // схлопнутая строка, — убираем его. ВАЖНО: id новых строк при
                // перенумерации СДВИГАЕТСЯ ВЛЕВО (подход 3-й становится 2-м и
                // получает id удалённой строки), поэтому guard запускается ПОЗЖЕ
                // обработчика данных, когда нумерация уже финальная, и проверяет,
                // что узел с этим id действительно лишний (payload >= числа подходов).
                const rowId = zone.id;
                setTimeout(function () {
                    try {
                        if (!rowId) return;
                        const twin = document.getElementById(rowId);
                        if (!twin || twin === zone) return;
                        const tp = String(twin.dataset.payload || '').split(':');
                        const p = String(payload).split(':');
                        const exIdxT = parseInt(p[0], 10);
                        const exT = (typeof state !== 'undefined' && state.activeWorkout &&
                                     state.activeWorkout.exercises) ? state.activeWorkout.exercises[exIdxT] : null;
                        const nSetsT = exT && exT.sets ? exT.sets.length : 0;
                        const sIdxT = parseInt(tp[1], 10);
                        // Узел легален, если его payload соответствует реальному количеству подходов.
                        if (isNaN(sIdxT) || sIdxT >= nSetsT) twin.remove();
                    } catch (err) {}
                }, 60);
            }
            function onEnd(e) {
                // Реагируем только на завершение схлопывания самой строки.
                if (e && e.target !== zone) return;
                if (e && e.propertyName && e.propertyName.indexOf('height') === -1) return;
                clearTimeout(safety);
                finalize();
            }
            // Страховка ВСЕГДА срабатывает, даже если WebView не прислал transitionend
            // (фоновые табы, reduced motion, особенности WKWebView).
            const safety = setTimeout(finalize, SWIPE_COLLAPSE_MS + 120);
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
                // Вправо — точно не наше. Влево с умеренным наклоном — всё ещё свайп:
                // на телефоне палец почти никогда не идёт идеально горизонтально,
                // прежний строгий фильтр (|dy| > |dx|) молча отменял большинство жестов.
                if (dx >= 0 || Math.abs(dy) > Math.abs(dx) * 2) {
                    tracking = false;                                 // крутой вертикальный скролл — пусть скроллит
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
        // Дубль на window: если в момент жеста строка была заменена в DOM
        // (перерисовка карточки), touchend приходит уже на другой узел и до
        // zone не доплывает — без этого жест «зависал» и удаление не срабатывало.
        function onTouchEndWindow(e) { finish(e); }
        window.addEventListener('touchend', onTouchEndWindow, { passive: true, capture: true });
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
        // При повторном касании этой же строки снимаем прежний window-dubler,
        // чтобы finish не вызывался несколько раз на одно касание.
        zone.addEventListener('touchstart', function () {
            window.removeEventListener('touchend', onTouchEndWindow, { capture: true });
        }, { passive: true });
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
