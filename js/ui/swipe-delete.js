/* ui/swipe-delete.js — свайп влево для удаления строк. */
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

(function initSwipeDelete() {
    function isFieldTarget(target, z) { return swipeIsFieldTarget(target, z); }

    function pointOf(e) {
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        return t ? { x: t.clientX, y: t.clientY } : { x: e.clientX, y: e.clientY };
    }

    function attachZone(zone) {
        if (!zone || zone.dataset.swipeBound === '1') return;
        zone.dataset.swipeBound = '1';

        let tracking = false, engaged = false, decided = false, removed = false;
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

        function collapseAndDelete(action, payload) {
            removed = true;
            zone.swipeAnimating = true;
            zone.dataset.swipeRemoving = '1';

            zone.classList.remove('card-enter');
            const l = layers();
            if (l.inner) l.inner.style.transform = '';
            if (l.bg) { l.bg.style.transform = ''; l.bg.classList.remove('visible'); }
            const h = zone.offsetHeight || 48;
            zone.style.maxHeight = h + 'px';
            void zone.offsetHeight;
            zone.classList.add('set-collapsing');
            nextFrame(function () {
                zone.style.maxHeight = '0px';
                zone.style.marginBottom = '0px';
                zone.style.opacity = '0';
            });

            let finalized = false;
            function finalize() {
                if (finalized) return;
                finalized = true;
                zone.removeEventListener('transitionend', onEnd);
                zone.removeEventListener('webkitTransitionEnd', onEnd);
                if (zone.parentNode) zone.remove();
                zone.swipeAnimating = false;
                delete zone.dataset.swipeRemoving;

                const handler = swipeLeftHandlers[action];
                if (!handler) {
                    console.warn('Unhandled swipe-left action:', action);
                    resetZone(zone);
                    return;
                }
                // Единственный источник изменений — обработчик данных (splice + пересборка списка).
                try { handler(action, payload); }
                catch (err) { console.error('Swipe-left handler error:', action, err); }
            }
            function onEnd(e) {
                if (e && e.target !== zone) return;
                if (e && e.propertyName && e.propertyName.indexOf('height') === -1) return;
                clearTimeout(safety);
                finalize();
            }
            const safety = setTimeout(finalize, SWIPE_COLLAPSE_MS + 120);
            zone.addEventListener('transitionend', onEnd);
            zone.addEventListener('webkitTransitionEnd', onEnd);
        }

        // ── touchstart ──
        zone.addEventListener('touchstart', function (e) {
            if (removed) return;
            if (e.touches.length !== 1) return;
            if (isFieldTarget(e.target, zone)) return;
            const p = pointOf(e);
            tracking = true; engaged = false; decided = false;
            startX = p.x; startY = p.y; curDx = 0; triggerDx = 0;
            setTransform(0, false);
        }, { passive: true });

        // ── touchmove: window, фаза захвата, passive:false ──
        function onTouchMove(e) {
            if (!tracking || removed) return;
            const p = pointOf(e);
            const dx = p.x - startX, dy = p.y - startY;

            if (!decided) {
                if (Math.abs(dx) < SWIPE_START_SLOP && Math.abs(dy) < SWIPE_START_SLOP) return;
                decided = true;
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
            if (e.cancelable) e.preventDefault();
            try { document.getSelection && document.getSelection().removeAllRanges(); } catch (err) {}
            triggerDx = dx;
            curDx = Math.max(-Math.round(bgWidth()), Math.min(0, dx));
            setTransform(curDx, false);
        }
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

        // ── завершение жеста ──
        function finish(e) {
            if (!tracking || removed) return;
            tracking = false;
            const wasEngaged = engaged;
            engaged = false;
            zone.classList.remove('swipe-active');
            if (!wasEngaged) return;

            if (triggerDx <= -SWIPE_TRIGGER_DX) {
                const action = zone.dataset.swipeLeft;
                const payload = zone.dataset.payload || '';
                try { haptic('medium'); } catch (err) {}
                showBg();
                setTransform(-Math.round(bgWidth()), true);
                setTimeout(function () { collapseAndDelete(action, payload); }, SWIPE_GLIDE_MS);
            } else {
                springBack();
            }
        }

        zone.addEventListener('touchend', finish, { passive: true });
        function onTouchCancel() {
            if (!tracking || removed) return;
            const wasEngaged = engaged;
            tracking = false; decided = false; engaged = false;
            zone.classList.remove('swipe-active');
            if (wasEngaged) springBack();
        }
        zone.addEventListener('touchcancel', onTouchCancel, { passive: true });
        window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    }

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

    // Привязка всех существующих строк (attachZone идемпотентен).
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
})();
