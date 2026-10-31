/* ui/swipe-delete.js — свайп влево для удаления строк.
   Архитектура: state — единственный источник истины; удаление выполняется по
   стабильному id (data-set-id), DOM пересобирается из state; жест — на Pointer
   Events с setPointerCapture и touch-action: pan-y в CSS. */
'use strict';

const SWIPE_TRIGGER_DX = 50;
const SWIPE_START_SLOP = 8;
const SWIPE_GLIDE_MS = 140;
const SWIPE_COLLAPSE_MS = 220;

const swipeLeftHandlers = {};
function registerSwipeLeftHandler(action, fn) { swipeLeftHandlers[action] = fn; }

function nextFrame(fn) {
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(fn); return; }
    setTimeout(fn, 0);
}

function cancelLongPressOn(zone) {
    try { if (typeof cancelLongPress === 'function') cancelLongPress(zone); } catch (err) {}
}

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

// Анимация схлопывания: высота -> 0, затем колбэк.
// ВАЖНО: анимируется КОПИЯ строки, вставленная вместо оригинала. Оригинальный
// узел немедленно скрывается и помечается mswipeDead — syncSetsListInPlace
// обязан удалять такие строки безусловно. Если бы анимировался сам оригинал,
// любое падение transitionend/таймера оставляло бы «живую» строку в DOM, а
// повторный свайп по ней уже не срабатывал (узел помечен удалённым). Копия
// гарантированно убирается страховочным таймером независимо от событий.
function collapseZoneRow(zone, onDone) {
    const ghost = zone.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.dataset.swipeLeft = '';
    ghost.removeAttribute('data-swipe-left');
    ghost.classList.remove('card-enter', 'swipe-active');
    ghost.classList.add('set-collapsing', 'set-ghost');
    // Копия не должна быть строкой списка: без set-line её не видят ни
    // commitVisibleSetInputs, ни syncSetsListInPlace — она не может «вернуть»
    // удалённый подход и не участвует в сверке DOM<->state.
    ghost.classList.remove('set-line');
    ghost.style.pointerEvents = 'none';
    ghost.style.maxHeight = (zone.offsetHeight || 48) + 'px';
    ghost.style.marginBottom = getComputedStyle(zone).marginBottom || '6px';
    ghost.style.opacity = '1';
    const inner = ghost.querySelector('.set-line-inner');
    if (inner) inner.style.transform = 'none';
    zone.parentNode.insertBefore(ghost, zone.nextSibling);

    zone.style.display = 'none';
    zone.dataset.swipeRemoving = '1';
    zone.mswipeDead = true;

    void ghost.offsetHeight; // фиксируем стартовое значение до перехода
    nextFrame(function () {
        ghost.style.maxHeight = '0px';
        ghost.style.marginBottom = '0px';
        ghost.style.opacity = '0';
    });

    let done = false;
    function finish() {
        if (done) return;
        done = true;
        ghost.removeEventListener('transitionend', onEnd);
        ghost.removeEventListener('webkitTransitionEnd', onEnd);
        clearTimeout(safety);
        if (ghost.parentNode) ghost.remove();
        if (onDone) onDone();
    }
    function onEnd(e) {
        if (e && e.target !== ghost) return;
        if (e && e.propertyName && e.propertyName.indexOf('height') === -1) return;
        finish();
    }
    const safety = setTimeout(finish, SWIPE_COLLAPSE_MS + 200);
    ghost.addEventListener('transitionend', onEnd);
    ghost.addEventListener('webkitTransitionEnd', onEnd);
}

function initSwipeDelete() {
    const hasPointerEvents = ('PointerEvent' in window);

    function isFieldTarget(target, z) { return swipeIsFieldTarget(target, z); }

    // Текущее активное движение (один жест одновременно).
    let activeMove = null;

    function attachZone(zone) {
        if (!zone || zone.dataset.swipeBound === '1') return;
        if (zone.mswipeDead || !zone.dataset.swipeLeft) return;
        // Привязка к строке, которая уже удалена из state (например, строка
        // перерисована во время анимации удаления), — гарантированно чистим
        // её из DOM. Иначе «призрачная» строка остаётся видна, повторный
        // свайп по ней не срабатывает, а следующий рендер восстанавливает
        // удалённый подход в списке.
        if (zone.dataset.swipeRemoving === '1' || zone.style.display === 'none') {
            if (zone.parentNode) zone.remove();
            return;
        }
        zone.dataset.swipeBound = '1';

        let tracking = false, engaged = false, decided = false, removed = false;
        let activePid = null;
        let startX = 0, startY = 0;
        let curDx = 0, triggerDx = 0;

        function layers() {
            return {
                inner: zone.querySelector('.set-line-inner'),
                bg: zone.querySelector('.set-swipe-bg')
            };
        }

        function bgWidth() { return (zone.clientWidth || zone.offsetWidth || 320) + 12; }

        function setTransform(px, animate) {
            const l = layers();
            if (!l.inner) return;
            l.inner.style.transition = animate ? 'transform ' + SWIPE_GLIDE_MS + 'ms ease-out' : 'none';
            l.inner.style.transform = 'translateX(' + px + 'px)';
            if (l.bg) {
                const reveal = Math.min(1, Math.abs(px) / bgWidth());
                l.bg.style.transition = animate ? 'transform ' + SWIPE_GLIDE_MS + 'ms ease-out, opacity .15s ease' : 'none';
                l.bg.style.transform = 'scaleX(' + reveal.toFixed(3) + ')';
            }
        }

        function showBg() {
            const l = layers();
            if (l.bg) l.bg.classList.add('visible');
        }

        function springBack() {
            curDx = 0; triggerDx = 0;
            setTransform(0, true);
            const l = layers();
            if (l.bg) setTimeout(function () { if (curDx === 0) l.bg.classList.remove('visible'); }, SWIPE_GLIDE_MS);
        }

        // Порядок: жест → анимация схлопывания (на копии) → данные (state).
        // Данные меняются ПОСЛЕ начала анимации: splice() выполняется в момент,
        // когда оригинальная строка уже скрыта и помечена mswipeDead, поэтому
        // syncSetsListInPlace удалит её безусловно — «воскрешение» невозможно.
        function commitDelete(action, payload) {
            removed = true;
            zone.swipeAnimating = true;
            window.__swipeDeleteInProgress = Date.now();

            let done = false;
            function finishDelete() {
                if (done) return;
                done = true;
                clearTimeout(safetyTimer);
                if (window.__mswipeSafety) { clearTimeout(window.__mswipeSafety); window.__mswipeSafety = null; }
                if (zone.parentNode) zone.remove();
                zone.swipeAnimating = false;

                const handler = swipeLeftHandlers[action];
                if (!handler) {
                    console.warn('Unhandled swipe-left action:', action);
                    return;
                }
                try { handler(action, payload); }
                catch (err) { console.error('Swipe-left handler error:', action, err); }
            }
            // Страховка: если колбэк схлопывания по любой причине не наступит,
            // удаление из state всё равно выполнится.
            const safetyTimer = setTimeout(finishDelete, SWIPE_GLIDE_MS + SWIPE_COLLAPSE_MS + 400);
            collapseZoneRow(zone, finishDelete);
        }

        function begin(x, y) {
            if (removed) return;
            // Одновременно отслеживаем только один жест: сбрасываем предыдущий.
            if (activeMove && activeMove !== zone && activeMove.__onTouchCancel) activeMove.__onTouchCancel();
            activeMove = zone;
            zone.mswipeTracking = true;
            tracking = true; engaged = false; decided = false;
            startX = x; startY = y; curDx = 0; triggerDx = 0;
            setTransform(0, false);
        }

        function move(x, y) {
            if (!tracking || removed) return;
            const dx = x - startX, dy = y - startY;

            if (!decided) {
                if (Math.abs(dx) < SWIPE_START_SLOP && Math.abs(dy) < SWIPE_START_SLOP) return;
                decided = true;
                // Наклонный жест оставляем браузеру (pan-y), чистая горизонталь — наша.
                if (dx >= 0 || Math.abs(dy) > Math.abs(dx) * 2) {
                    tracking = false; zone.mswipeTracking = false;
                    if (activeMove === zone) activeMove = null;
                    return;
                }
                engaged = true;
                cancelLongPressOn(zone);
                zone.classList.add('swipe-active');
                showBg();
            }

            if (!engaged) return;
            try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
            triggerDx = dx;
            curDx = Math.max(-Math.round(bgWidth()), Math.min(0, dx));
            setTransform(curDx, false);
        }

        function end() {
            if (!tracking || removed) return;
            tracking = false; zone.mswipeTracking = false;
            if (activeMove === zone) activeMove = null;
            const wasEngaged = engaged;
            engaged = false;
            zone.classList.remove('swipe-active');
            if (!wasEngaged) return;

            if (triggerDx <= -SWIPE_TRIGGER_DX) {
                const action = zone.dataset.swipeLeft;
                const payload = zone.dataset.payload || '';
                // Жёсткая страховка: даже если цепочка схлопывания/колбэков
                // оборвётся (WebView, requestAnimationFrame), state будет
                // изменён ровно один раз — removeSet идемпотентен.
                window.__mswipeSafety = setTimeout(function () {
                    window.__mswipeSafety = null;
                    commitDelete(action, payload);
                }, SWIPE_GLIDE_MS + SWIPE_COLLAPSE_MS + 600);
                try { haptic('medium'); } catch (err) {}
                showBg();
                setTransform(-Math.round(bgWidth()), true);
                setTimeout(function () { commitDelete(action, payload); }, SWIPE_GLIDE_MS);
            } else {
                springBack();
            }
        }

        function cancel() {
            if (!tracking || removed) return;
            const wasEngaged = engaged;
            tracking = false; zone.mswipeTracking = false; decided = false; engaged = false;
            if (activeMove === zone) activeMove = null;
            zone.classList.remove('swipe-active');
            if (wasEngaged) springBack();
        }

        if (hasPointerEvents) {
            zone.addEventListener('pointerdown', function (e) {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                if (isFieldTarget(e.target, zone)) return;
                begin(e.clientX, e.clientY);
                activePid = e.pointerId;
                try { zone.setPointerCapture(e.pointerId); } catch (err) {}
            });
            zone.addEventListener('pointermove', function (e) {
                if (!tracking || e.pointerId !== activePid) return;
                move(e.clientX, e.clientY);
            });
            zone.addEventListener('pointerup', function (e) {
                if (e.pointerId !== activePid) return;
                activePid = null;
                end();
            });
            zone.addEventListener('pointercancel', function (e) {
                if (activePid !== null && e.pointerId !== activePid) return;
                activePid = null;
                cancel();
            });
        } else {
            // Fallback для старых WKWebView без Pointer Events.
            zone.addEventListener('touchstart', function (e) {
                if (e.touches.length !== 1) return;
                if (isFieldTarget(e.target, zone)) return;
                const t = e.touches[0];
                begin(t.clientX, t.clientY);
            }, { passive: true });

            function onTouchMove(e) {
                if (!tracking || removed) return;
                const t = e.touches && e.touches[0];
                if (!t) return;
                const dx = t.clientX - startX, dy = t.clientY - startY;
                if (!decided) {
                    if (Math.abs(dx) < SWIPE_START_SLOP && Math.abs(dy) < SWIPE_START_SLOP) return;
                    decided = true;
                    if (dx >= 0 || Math.abs(dy) > Math.abs(dx) * 2) { tracking = false; return; }
                    engaged = true;
                    cancelLongPressOn(zone);
                    zone.classList.add('swipe-active');
                    showBg();
                }
                if (!engaged) return;
                if (e.cancelable) e.preventDefault();
                try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
                triggerDx = dx;
                curDx = Math.max(-Math.round(bgWidth()), Math.min(0, dx));
                setTransform(curDx, false);
            }
            zone.__onTouchMove = onTouchMove;
            zone.__onTouchEnd = function () { end(); };
            zone.__onTouchCancel = cancel;
        }
    }

    // Единые глобальные слушатели Touch-фолбэка: события всегда доходят до модуля
    // (даже если строка перерисована в середине жеста), а обрабатывает их зона,
    // начавшая движение (activeMove).
    window.addEventListener('touchmove', function (e) {
        if (activeMove && activeMove.__onTouchMove) activeMove.__onTouchMove(e);
    }, { passive: false, capture: true });
    window.addEventListener('touchend', function () {
        if (activeMove && activeMove.__onTouchEnd) activeMove.__onTouchEnd();
    }, { passive: true, capture: true });
    window.addEventListener('touchcancel', function () {
        if (activeMove && activeMove.__onTouchCancel) activeMove.__onTouchCancel();
    }, { passive: true, capture: true });

    function bindAllExisting() {
        const list = document.querySelectorAll('[data-swipe-left]');
        for (let i = 0; i < list.length; i++) attachZone(list[i]);
    }

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
        bindAllExisting();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
    window.bindSwipeZones = bindAllExisting;
    document.addEventListener('workout:rendered', bindAllExisting);
}

if (typeof document !== 'undefined') initSwipeDelete();
