/* ui/long-press.js — универсальный детектор долгого нажатия (контекстные действия).

   Как подключается к разметке: элементу достаточно атрибутов
       data-longpress="<имя действия>"  data-payload="<данные>"
   Обработчик делегируется на document (один на всё приложение), поэтому работает
   для динамически перерисованных карточек без повторной инициализации.

   Обработчик ничего не знает о фичах: он ищет action в реестре longPressHandlers
   и вызывает зарегистрированный колбэк(action, payload). Реестр пополняет
   js/features/workout/workout-context-menu.js через registerLongPressHandler().

   Важно: долгое нажатие НЕ должно срабатывать на полях ввода и кнопках «+/−»,
   иначе ломается ввод веса/повторений и быстрые шаги. */
'use strict';

const LONG_PRESS_MS = 450;            // порог «долгого» нажатия
const LONG_PRESS_MOVE_TOLERANCE = 10; // px: больше — это скролл, не нажатие

// Реестр обработчиков: action → функция(action, payload). Регистрирует фичевый модуль
// (features/workout/workout-context-menu.js) через registerLongPressHandler().
const longPressHandlers = {};
function registerLongPressHandler(action, fn) { longPressHandlers[action] = fn; }

(function initLongPress() {
    let timer = null;
    let startX = 0, startY = 0;
    let zone = null;                 // зона долгого нажатия (не двигаем DOM во времени)
    let suppressClick = false;       // true, если жест уже распознан как долгий

    function cancel() {
        if (timer) { clearTimeout(timer); timer = null; }
        zone = null;
    }
    // Внешний API: отменить ожидаемое долгое нажатие (его вызывает свайп-жест,
    // чтобы два жеста на одной строке не конкурировали).
    function cancelLongPress(el) {
        if (!el || !zone) return;
        if (el === zone || zone.contains(el) || el.contains(zone)) cancel();
    }

    // Долгое нажатие НЕ должно срабатывать, если палец попал на инпут, кнопку «+/−» или
    // любой элемент со своим data-action. Раньше проверка шла вверх от e.target вплоть до
    // <body>: из-за этого любое действие вне карточки (например кнопка «+ Подход» под
    // списком) отменяло жест на всём экране — контекстное меню не открывалось никогда.
    // Теперь поднимаемся от точки касания только до самой зоны [data-longpress].
    const INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LABEL', 'A'];

    // hasAttribute, а не attributes['data-action']: в некоторых WebView (и в мини-DOM
    // тестах) NamedNodeMap ведёт себя иначе — hasAttribute надёжнее.
    function isInteractiveTarget(target, z) {
        let cur = target;
        while (cur && cur !== document.body) {
            if (INTERACTIVE.indexOf(cur.tagName) !== -1) return true;
            if (cur.hasAttribute && cur.hasAttribute('data-action')) return true;   // чужие клики — не наш жест
            if (cur === z) break;                       // выше зоны long-press решений не принимаем
            cur = cur.parentElement;
        }
        return false;
    }

    // Зона не должна лежать внутри элемента со своим data-action (чужой клик).
    function hasOwnAction(el) {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.hasAttribute && cur.hasAttribute('data-action')) return true;
            cur = cur.parentElement;
        }
        return false;
    }

    // Поддержка устройств/WebView без Pointer Events (старые Android) — fallback на touch-события.
    const HAS_POINTER = ('onpointerdown' in window);

    function begin(target, x, y) {
        const z = target.closest ? target.closest('[data-longpress]') : null;
        if (!z) return;
        if (isInteractiveTarget(target, z)) return;          // попали по кнопке/инпуту — не наш жест
        if (hasOwnAction(z.parentElement)) return;           // зона внутри чужой кнопки — не наш жест
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
        try { haptic('medium'); } catch (e) {}   // отклик: действие принято
        const action = zone.dataset.longpress;
        const payload = zone.dataset.payload || '';
        const handler = longPressHandlers[action];
        if (zone.classList) zone.classList.add('lp-active');   // подсветка зоны до перерисовки
        cancel();                // зону больше не держим — колбэк может перерисовать DOM
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
        // Fallback: Touch Events. Касание стартует только внутри зоны long-press,
        // поэтому ввод в инпутах и клики по кнопкам не затрагиваются.
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
    // pointerleave уместен только мыши (палец «уходит» вместе с pointerup)
    document.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') cancel(); }, { passive: true });

    // Долгий жест не должен оставлять за собой обычный клик по элементу под пальцем.
    document.addEventListener('click', function (e) {
        if (!suppressClick) return;
        suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
    }, true);
})();
