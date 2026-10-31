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

// Копия строки для анимации схлопывания: оригинальный узел удаляется из DOM
// сразу после изменения state, поэтому никакая перерисовка не мешает анимации.
function collapseGhostRow(ghost, onDone) {
    ghost.removeAttribute('id');
    Array.prototype.forEach.call(ghost.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
    ghost.classList.remove('card-enter');
    ghost.classList.add('set-collapsing');
    const gi = ghost.querySelector('.set-line-inner');
    if (gi) { gi.style.transition = 'max-height .22s ease-out, opacity .18s ease-out'; gi.style.transform = 'translateX(-100%)'; void gi.offsetWidth; gi.style.transform = ''; }
    const gb = ghost.querySelector('.set-swipe-bg');
    if (gb) { gb.style.transition = 'none'; gb.style.transform = 'scaleX(0)'; gb.classList.remove('visible'); }

    const parent = ghost.parentNode;
    const prevMargin = ghost.style.marginBottom;
    const h = ghost.offsetHeight || 48;
    ghost.style.maxHeight = h + 'px';
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
        if (parent) parent.style.height = '';
        if (onDone) onDone();
    }
    function onEnd(e) {
        if (e && e.target !== ghost) return;
        if (e && e.propertyName && e.propertyName.indexOf('height') === -1) return;
        finish();
    }
    const safety = setTimeout(finish, SWIPE_COLLAPSE_MS + 150);
    ghost.addEventListener('transitionend', onEnd);
    ghost.addEventListener('webkitTransitionEnd', onEnd);
    void prevMargin;
}

function initSwipeDelete() {
    const hasPointerEvents = ('PointerEvent' in window);

    function isFieldTarget(target, z) { return swipeIsFieldTarget(target, z); }

    function attachZone(zone) {
        if (!zone || zone.dataset.swipeBound === '1') return;
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

        // Порядок строго такой: state → DOM → анимация на копии.
        // Флаг data-swipe-removing ставится СРАЗУ при срабатывании жеста — все
        // перерисовки списка (в т.ч. по «+ Подход») обязаны игнорировать такую
        // строку: она уже обещана к удалению. Данные меняются сразу, до
        // схлопывания, чтобы добавление подхода никогда не работало со старым
        // массивом. Анимация идёт на копии: оригинальный узел остаётся на месте
        // скрытым маркером-заглушкой.
        function commitDelete(action, payload) {
            removed = true;
            zone.swipeAnimating = true;
            zone.dataset.swipeRemoving = '1';
            window.__swipeDeleteInProgress = true;

            const handler = swipeLeftHandlers[action];
            if (!handler) {
                console.warn('Unhandled swipe-left action:', action);
                delete zone.dataset.swipeRemoving;
                window.__swipeDeleteInProgress = false;
                zone.swipeAnimating = false;
                springBack();
                return;
            }

            try { handler(action, payload); }
            catch (err) { console.error('Swipe-left handler error:', action, err); }

            const ghost = zone.cloneNode(true);
            ghost.style.display = 'none';
            if (zone.parentNode) zone.parentNode.insertBefore(ghost, zone.nextSibling);
            collapseGhostRow(ghost, function () {
                if (zone.parentNode) zone.remove();
                zone.swipeAnimating = false;
                window.__swipeDeleteInProgress = false;
            });
        }

        function begin(x, y) {
            if (removed) return;
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
                    tracking = false;
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
            tracking = false;
            const wasEngaged = engaged;
            engaged = false;
            zone.classList.remove('swipe-active');
            if (!wasEngaged) return;

            if (triggerDx <= -SWIPE_TRIGGER_DX) {
                const action = zone.dataset.swipeLeft;
                const payload = zone.dataset.payload || '';
                zone.dataset.swipeRemoving = '1';
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
            tracking = false; decided = false; engaged = false;
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
                const t = e.touches[0];
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
            window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

            zone.addEventListener('touchend', function () { end(); }, { passive: true });
            zone.addEventListener('touchcancel', cancel, { passive: true });
            window.addEventListener('touchcancel', cancel, { passive: true });
        }
    }

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
