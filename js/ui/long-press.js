/* ui/long-press.js — детектор долгого нажатия. Подключение: data-longpress="<действие>"
   data-payload="<данные>"; обработчики регистрируются через registerLongPressHandler().
   Жест не срабатывает на полях ввода и кнопках со своим data-action. */
'use strict';

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 10;

const longPressHandlers = {};
function registerLongPressHandler(action, fn) { longPressHandlers[action] = fn; }

(function initLongPress() {
    let timer = null;
    let startX = 0, startY = 0;
    let zone = null;
    let suppressClick = false;

    function cancel() {
        if (timer) { clearTimeout(timer); timer = null; }
        zone = null;
    }
    function cancelLongPress(el) {
        if (!el || !zone) return;
        if (el === zone || zone.contains(el) || el.contains(zone)) cancel();
    }

    // Проверка поднимается от точки касания только до самой зоны [data-longpress].
    const INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LABEL', 'A'];

    function isInteractiveTarget(target, z) {
        let cur = target;
        while (cur && cur !== document.body) {
            if (INTERACTIVE.indexOf(cur.tagName) !== -1) return true;
            if (cur.hasAttribute && cur.hasAttribute('data-action')) return true;
            if (cur === z) break;
            cur = cur.parentElement;
        }
        return false;
    }

    function hasOwnAction(el) {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.hasAttribute && cur.hasAttribute('data-action')) return true;
            cur = cur.parentElement;
        }
        return false;
    }

    const HAS_POINTER = ('onpointerdown' in window);

    function begin(target, x, y) {
        const z = target.closest ? target.closest('[data-longpress]') : null;
        if (!z) return;
        if (isInteractiveTarget(target, z)) return;
        if (hasOwnAction(z.parentElement)) return;
        zone = z;
        startX = x; startY = y;
        timer = setTimeout(function () { fire(); }, LONG_PRESS_MS);
    }

    function move(x, y) {
        if (!timer) return;
        if (Math.abs(x - startX) > LONG_PRESS_MOVE_TOLERANCE ||
            Math.abs(y - startY) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    }

    function fire() {
        timer = null;
        if (!zone) return;
        suppressClick = true;
        try { haptic('medium'); } catch (e) {}
        const action = zone.dataset.longpress;
        const payload = zone.dataset.payload || '';
        const handler = longPressHandlers[action];
        if (zone.classList) zone.classList.add('lp-active');
        cancel();
        if (!handler) { console.warn('Unhandled long-press action:', action); return; }
        try { handler(action, payload); }
        catch (err) { console.error('Long-press handler error:', action, err); }
    }

    if (HAS_POINTER) {
    document.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        begin(e.target, e.clientX, e.clientY);
    }, { passive: true });

    document.addEventListener('pointermove', function (e) {
        move(e.clientX, e.clientY);
    }, { passive: true });
    } else {
        // Fallback для WebView без Pointer Events.
        document.addEventListener('touchstart', function (e) {
            if (!e.target.closest('[data-longpress]')) return;
            const t = e.touches[0];
            begin(e.target, t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            const t = e.touches[0]; if (!t) return;
            move(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchend', cancel, { passive: true });
        document.addEventListener('touchcancel', cancel, { passive: true });
    }

    document.addEventListener('pointerup', cancel, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
    document.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') cancel(); }, { passive: true });

    document.addEventListener('click', function (e) {
        if (!suppressClick) return;
        suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
    }, true);
})();
