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

    // Внутри зоны есть интерактив (инпуты, кнопки «+/−») — долгое нажатие не наш жест.
    // Проверка без selector-matching: в Telegram WebView / старых движках он может отсутствовать.
    const INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LABEL', 'A'];
    function isInteractive(el) {
        let cur = el;
        while (cur) {
            if (INTERACTIVE.indexOf(cur.tagName) !== -1) return true;
            if (cur.attributes && cur.attributes['data-action']) return true;   // чужие клики — не наш жест
            cur = cur.parentElement;
        }
        return false;
    }

    document.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const z = e.target.closest('[data-longpress]');
        if (!z || isInteractive(e.target)) return;
        zone = z;
        startX = e.clientX; startY = e.clientY;
        timer = setTimeout(function () {
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
        }, LONG_PRESS_MS);
    }, { passive: true });

    document.addEventListener('pointermove', function (e) {
        if (!timer) return;
        if (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_TOLERANCE ||
            Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    }, { passive: true });

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
